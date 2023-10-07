// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ZKLinkL1GatewayBase.sol";

contract ZKLinkL1Gateway is ZKLinkL1GatewayBase {
    constructor(IMessageService _messageService, IZkSync _zksync) {
        messageService = _messageService;
        zksync = _zksync;
    }

    function depositERC20ByLinea(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override {
        if (lineaFeeOn && msg.value != lineaFee) {
            revert InvalidFee();
        }

        if ((bridges[_token] == address(0)) || (remoteBridge[_token] == address(0))) {
            revert TokenNotSupport();
        }

        if (remoteTokens[_token] == address(0)) {
            revert NoRemoteTokenSet();
        }

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20(_token).approve(bridges[_token], _amount);

        // deposit erc20
        uint256 nonce = messageService.nextMessageNumber();
        bytes memory _calldata = abi.encodeCall(ILineaERC20Bridge.receiveFromOtherLayer, (remoteGateway[Chains.Linea], _amount));
        bytes32 messageHash = keccak256(abi.encode(bridges[_token], remoteBridge[_token], 0, 0, nonce, _calldata));

        ILineaERC20Bridge(bridges[_token]).depositTo(_amount, remoteGateway[Chains.Linea]);

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            ILineaGateway.claimDepositERC20Callback,
            (remoteTokens[_token], _amount, _zkLinkAddress, _subAccountId, _mapping, messageHash)
        );
        messageService.sendMessage(remoteGateway[Chains.Linea], 0, verifyCalldata);

        txNonce++;
        emit DepositLineaERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, _calldata, nonce, messageHash, txNonce);
    }

    function depositETHByLinea(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override {
        require(msg.value < 2 ** 128, "16");
        uint104 amount = lineaFeeOn ? uint104(msg.value) - lineaFee : uint104(msg.value);

        bytes memory _calldata = abi.encodeCall(ILineaGateway.claimDepositETH, (_zkLinkAddress, _subAccountId, amount));

        messageService.sendMessage{value: msg.value}(remoteGateway[Chains.Linea], 0, _calldata);

        txNonce++;
        emit DepositLineaETH(_zkLinkAddress, _subAccountId, amount, txNonce);
    }

    ///
    /// @param _token L1 ERC20 token address
    /// @param _amount amount to bridge
    /// @param _zkLinkAddress zklink address
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    /// @param _extendParams abi.encode(uint256 defaultBridgeGasLimit, uint256 defaultBridgeCost,uint256 l2GasLimit,uint256 gatewayCost)
    function depositERC20ByZksync(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes calldata _extendParams
    ) external payable override {
        (uint256 _defaultBridgeGasLimit, uint256 _defaultBridgeCost, uint256 _l2GasLimit, uint256 _gatewayCost) = abi.decode(_extendParams, (uint256, uint256, uint256, uint256));

        if (zksyncFeeOn) {
            require(msg.value == _defaultBridgeCost + _gatewayCost + zksyncFee, "fee");
        }

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20(_token).approve(zksyncL1Bridge, _amount);

        // bridge erc20 to remote gateway
        bytes32 txhash = IZKSyncL1Bridge(zksyncL1Bridge).deposit{value: _defaultBridgeCost}(
            remoteGateway[Chains.ZKSync],
            _token,
            _amount,
            _defaultBridgeGasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            refundRecipient
        );

        bytes memory _calldata = abi.encodeCall(
            IZKSyncGateway.depositERC20,
            (IZKSyncL1Bridge(zksyncL1Bridge).l2TokenAddress(_token), _amount, _zkLinkAddress, _subAccountId, _mapping)
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

        txNonce++;
        emit DepositZksyncERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, txhash, txNonce);
    }

    /// deposit ETH to zklink by zksync bridge
    /// @param zklinkAddress zklink address
    /// @param subAccountId sub account id
    /// @param amount amount eth to bridge
    /// @param l2GasLimit L2 depositETH function call gas limit
    function depositETHByZksync(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, uint256 l2GasLimit, uint256 baseCost) external payable override {
        if (zksyncFeeOn) {
            require(msg.value == amount + zksyncFee + baseCost, "fee");
        }

        bytes memory _calldata = abi.encodeCall(IZKSyncGateway.depositETH, (zklinkAddress, subAccountId));
        bytes32 txhash = zksync.requestL2Transaction{value: baseCost + amount}(
            address(remoteGateway[Chains.ZKSync]),
            amount,
            _calldata,
            l2GasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            new bytes[](0),
            refundRecipient
        );

        txNonce++;
        emit DepositZKSyncETH(zklinkAddress, subAccountId, amount, txhash, txNonce);
    }
}
