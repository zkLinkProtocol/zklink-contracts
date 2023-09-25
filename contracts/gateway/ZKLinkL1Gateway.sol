// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IZkSync} from "../interfaces/IZkSync.sol";
import {ILineaERC20Bridge} from "../interfaces/ILineaERC20Bridge.sol";
import {IMessageService} from "../interfaces/IMessageService.sol";
import {ILineaGateway} from "../interfaces/ILineaGateway.sol";
import {IZKSyncGateway} from "../interfaces/IZKSyncGateway.sol";
import {IZKSyncL1Bridge} from "../interfaces/IZKSyncL1Bridge.sol";
import {IZKLinkL1Gateway} from "../interfaces/IZKLinkL1Gateway.sol";

contract ZKLinkL1Gateway is Ownable, IZKLinkL1Gateway {
    /// @notice zksync l2TxGasPerPubdataByte
    uint256 public constant REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

    /// @notice if fee on, when bridge from ethereum to linea should pay l2 claim message gas fee
    bool public feeOn;

    /// @notice amount of L2 claim message fees users should pay for
    uint256 public fee;

    /// @notice linea message service address
    IMessageService public messageService;

    /// @dev Remote Gateway address
    mapping(Chains => address) remoteGateway;

    /// @dev Mapping from token to token bridge (only linea)
    mapping(address => address) bridges;

    /// @dev Mapping from token to remote bridge (only linea)
    mapping(address => address) remoteBridge;

    /// @dev Mapping L1 token address to L2 token address
    mapping(address => address) remoteTokens;

    /***********************************************
     * ZKSync
     ***********************************************/
    /// @notice zksync L1 message service
    IZkSync public zksync;

    /// @notice zksync refund recipient on L2
    address payable public refundRecipient;

    /// @notice zksync l1 bridge address
    address public zksyncL1Bridge;

    modifier addressZeroCheck(address addressToSet) {
        if (addressToSet == address(0)) {
            revert InvalidParmas();
        }
        _;
    }

    function setFeeOn(bool _feeOn) external onlyOwner {
        feeOn = _feeOn;
        emit SetFeeOn(_feeOn);
    }

    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    ) external payable override {
        if (feeOn && msg.value != fee) {
            revert InvalidFee();
        }

        if (
            (bridges[_token] == address(0)) ||
            (remoteBridge[_token] == address(0))
        ) {
            revert TokenNotSupport();
        }

        if (remoteTokens[_token] == address(0)) {
            revert NoRemoteTokenSet();
        }

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20(_token).approve(bridges[_token], _amount);

        // deposit erc20
        uint256 nonce = messageService.nextMessageNumber();
        bytes memory _calldata = abi.encodeCall(
            ILineaERC20Bridge.receiveFromOtherLayer,
            (remoteGateway[Chains.Linea], _amount)
        );
        bytes32 messageHash = keccak256(
            abi.encode(
                bridges[_token],
                remoteBridge[_token],
                0,
                0,
                nonce,
                _calldata
            )
        );

        ILineaERC20Bridge(bridges[_token]).depositTo(
            _amount,
            remoteGateway[Chains.Linea]
        );

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            ILineaGateway.claimDepositERC20Callback,
            (
                remoteTokens[_token],
                _amount,
                _zkLinkAddress,
                _subAccountId,
                _mapping,
                messageHash
            )
        );
        messageService.sendMessage(
            remoteGateway[Chains.Linea],
            0,
            verifyCalldata
        );
        emit DepositERC20(
            _token,
            _amount,
            _zkLinkAddress,
            _subAccountId,
            _mapping,
            _calldata,
            nonce,
            messageHash
        );
    }

    function depositETH(
        bytes32 _zkLinkAddress,
        uint8 _subAccountId
    ) external payable override {
        require(msg.value < 2 ** 128, "16");
        bytes memory _calldata = abi.encodeCall(
            ILineaGateway.claimDepositETH,
            (_zkLinkAddress, _subAccountId, uint104(msg.value))
        );

        messageService.sendMessage{value: msg.value}(
            remoteGateway[Chains.Linea],
            0,
            _calldata
        );
        emit DepositETH(_zkLinkAddress, _subAccountId, uint104(msg.value));
    }

    ///
    /// @param _token L1 ERC20 token address
    /// @param _amount amount to bridge
    /// @param _zkLinkAddress zklink address
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    /// @param _extendParams abi.encode(uint256 defaultBridgeGasLimit, uint256 defaultBridgeCost,uint256 l2GasLimit,uint256 gatewayCost)
    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes calldata _extendParams
    ) external payable {
        (
            uint256 _defaultBridgeGasLimit,
            uint256 _defaultBridgeCost,
            uint256 _l2GasLimit,
            uint256 _gatewayCost
        ) = abi.decode(_extendParams, (uint256, uint256, uint256, uint256));

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20(_token).approve(zksyncL1Bridge, _amount);

        // bridge erc20 to remote gateway
        bytes32 txhash = IZKSyncL1Bridge(zksyncL1Bridge).deposit{
            value: _defaultBridgeCost
        }(
            remoteGateway[Chains.ZKSync],
            _token,
            _amount,
            _defaultBridgeGasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            refundRecipient
        );

        bytes memory _calldata = abi.encodeCall(
            IZKSyncGateway.depositERC20,
            (
                IZKSyncL1Bridge(zksyncL1Bridge).l2TokenAddress(_token),
                _amount,
                _zkLinkAddress,
                _subAccountId,
                _mapping
            )
        );

        zksync.requestL2Transaction{value: _gatewayCost}(
            remoteGateway[Chains.ZKSync],
            0,
            _calldata,
            _l2GasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            new bytes[](0),
            refundRecipient
        );

        emit DepositZksyncERC20(
            _token,
            _amount,
            _zkLinkAddress,
            _subAccountId,
            _mapping,
            txhash
        );
    }

    /// deposit ETH to zklink by zksync bridge
    /// @param zklinkAddress zklink address
    /// @param subAccountId sub account id
    /// @param amount amount eth to bridge
    /// @param l2GasLimit L2 depositETH function call gas limit
    function depositETH(
        bytes32 zklinkAddress,
        uint8 subAccountId,
        uint256 amount,
        uint256 l2GasLimit
    ) external payable {
        bytes memory _calldata = abi.encodeCall(
            IZKSyncGateway.depositETH,
            (zklinkAddress, subAccountId)
        );
        bytes32 txhash = zksync.requestL2Transaction{value: msg.value}(
            address(remoteGateway[Chains.ZKSync]),
            amount,
            _calldata,
            l2GasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            new bytes[](0),
            refundRecipient
        );

        emit DepositETH(zklinkAddress, subAccountId, amount, txhash);
    }

    /// @notice set linea ERC20 bridges of L1
    /// @param _tokens L1 ERC20 tokens
    /// @param _bridges L1 bridges of ERC20 tokens
    function setBridges(
        address[] calldata _tokens,
        address[] calldata _bridges
    ) external onlyOwner {
        if (_tokens.length != _bridges.length) {
            revert InvalidParmas();
        }

        for (uint i = 0; i < _tokens.length; i++) {
            bridges[_tokens[i]] = _bridges[i];
            emit SetBridge(_tokens[i], _bridges[i]);
        }
    }

    /// @notice set linea L2 bridges of l1 tokens
    /// @param _tokens L1 tokens of linea
    /// @param _remoteBridges L2 bridges of L1 tokens
    function setRemoteBridges(
        address[] calldata _tokens,
        address[] calldata _remoteBridges
    ) external onlyOwner {
        if (_tokens.length != _remoteBridges.length) {
            revert InvalidParmas();
        }

        for (uint i = 0; i < _tokens.length; i++) {
            remoteBridge[_tokens[i]] = _remoteBridges[i];
            emit SetRemoteBridge(_tokens[i], _remoteBridges[i]);
        }
    }

    /// @notice set remote Gateway address
    /// @param _chain Chains.Linea || Chains.ZKSync
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(
        Chains _chain,
        address _remoteGateway
    ) external onlyOwner {
        if (_remoteGateway == address(0)) {
            revert InvalidParmas();
        }

        remoteGateway[_chain] = _remoteGateway;
    }

    /// set L2 ERC20 tokens of L1
    /// @param _tokens linea L1 ERC20 tokens
    /// @param _remoteTokens linea L2 ERC20 tokens
    function setRemoteTokens(
        address[] calldata _tokens,
        address[] calldata _remoteTokens
    ) external onlyOwner {
        if (_tokens.length != _remoteTokens.length) {
            revert InvalidParmas();
        }

        for (uint i = 0; i < _tokens.length; i++) {
            remoteTokens[_tokens[i]] = _remoteTokens[i];
            emit SetRemoteToken(_tokens[i], _remoteTokens[i]);
        }
    }

    /// @notice set linea L1 message service
    /// @param _messageService message service address
    function setMessageService(
        address _messageService
    ) external addressZeroCheck(_messageService) onlyOwner {
        messageService = IMessageService(_messageService);
    }

    /// set zksync L1 message service
    /// @param _zksync zksync message service
    function setZKSync(IZkSync _zksync) external onlyOwner {
        if (address(_zksync) == address(0)) {
            revert InvalidParmas();
        }
        zksync = _zksync;
    }

    /// set refund recipient address of zksync
    /// @param _refundRecipient refund recipient address, suggest EOA address
    function setRefundRecipient(
        address _refundRecipient
    ) external addressZeroCheck(_refundRecipient) onlyOwner {
        refundRecipient = payable(_refundRecipient);
    }

    /// set zksync l1 bridge
    /// @param _zksyncL1Bridge zksync l1 bridge
    function setZKSyncL1Bridge(
        address _zksyncL1Bridge
    ) external addressZeroCheck(_zksyncL1Bridge) onlyOwner {
        zksyncL1Bridge = _zksyncL1Bridge;
    }

    /// @notice get linea L1 bridge of token
    /// @param token ERC20 token address
    function getBridge(address token) external view returns (address) {
        return bridges[token];
    }

    /// @notice get linea L2 bridge address of L1 token
    /// @param token ERC20 token address
    function getRemoteBridge(address token) external view returns (address) {
        return remoteBridge[token];
    }

    /// get linea l2 token address of L1 token
    /// @param token L1 ERC20 token address
    function getRemoteToken(address token) external view returns (address) {
        return remoteTokens[token];
    }
}
