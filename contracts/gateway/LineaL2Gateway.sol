// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";

contract LineaL2Gateway is OwnableUpgradeable, UUPSUpgradeable, ILineaL2Gateway {
    uint8 public constant INBOX_STATUS_UNKNOWN = 0;
    uint8 public constant INBOX_STATUS_RECEIVED = 1;
    uint8 public constant INBOX_STATUS_CLAIMED = 2;

    /// @notice Claim fee recipient
    address payable public feeRecipient;

    /// @notice message service address
    IMessageService public messageService;

    /// @notice Remote Gateway address
    address public remoteGateway;

    /// @notice zklink contract of linea
    address public zklinkContract;

    /// @dev Mapping from token to token bridge
    mapping(address => address) internal bridges;

    /// @dev Mapping from token to remote bridge
    mapping(address => address) internal remoteBridges;

    /// @dev Mapping L1 token address to L2 token address
    mapping(address => address) internal remoteTokens;

    /// @dev Mapping from messageHash to bool
    mapping(bytes32 => bool) internal messageHashUsed;

    /// @notice current claim messageHash
    bytes32 public messageHash;

    modifier onlyMessageService() {
        require(msg.sender == address(messageService), "M0");
        _;
    }

    function initialize(IMessageService _messageService, address _zklinkContract) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        messageService = _messageService;
        zklinkContract = _zklinkContract;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// claim deposit ERC20 message
    /// @param _token L2 ERC20 token address
    /// @param _calldata deposit ERC20 message calldata
    /// @param _nonce deposit ETC20 message nonce
    /// @param _cbCalldata verify params message calldata
    /// @param _cbNonce verify params message nonce
    function claimDepositERC20(address _token, bytes calldata _calldata, uint256 _nonce, bytes calldata _cbCalldata, uint256 _cbNonce) external override {
        messageHash = keccak256(abi.encode(remoteBridges[_token], bridges[_token], 0, 0, _nonce, _calldata));
        uint256 status = messageService.inboxL1L2MessageStatus(messageHash);
        require(status != INBOX_STATUS_UNKNOWN, "M1");

        // if status == INBOX_STATUS_CLAIMED means someone else claimed erc20 token directly
        if (status == INBOX_STATUS_RECEIVED) {
            // claim erc20 token
            (bool success, bytes memory errorInfo) = address(messageService).call(
                abi.encodeCall(IMessageService.claimMessage, (remoteBridges[_token], bridges[_token], 0, 0, feeRecipient, _calldata, _nonce))
            );

            require(success, string(errorInfo));
        }

        // claim callback message to verify messages
        messageService.claimMessage(remoteGateway, address(this), 0, 0, feeRecipient, _cbCalldata, _cbNonce);
    }

    /// claim deposit ERC20 verify params callback
    /// @param _token L2 ERC20 token address
    /// @param _amount amount to deposit
    /// @param _zkLinkAddress zklink address.
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    /// @param _messageHash linea bridge deposit messageHash
    function claimDepositERC20Callback(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes32 _messageHash
    ) external override onlyMessageService {
        require(messageHash == _messageHash, "M2");

        // approve token to zklink
        IERC20(_token).approve(zklinkContract, _amount);

        // deposit erc20 to zklink
        (bool success, bytes memory errorInfo) = zklinkContract.call(abi.encodeCall(IZkLink.depositERC20, (IERC20(_token), _amount, _zkLinkAddress, _subAccountId, _mapping)));

        if (success) {
            messageHashUsed[messageHash] = true;
        }

        // reset messageHash
        messageHash = bytes32(0);

        emit ClaimedDepositERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, success, errorInfo);
    }

    function claimDepositETH(bytes calldata _calldata, uint256 _nonce, uint256 _amount) external override {
        messageService.claimMessage(remoteGateway, address(this), 0, _amount, feeRecipient, _calldata, _nonce);
    }

    /// claim deposit ETH message hash
    /// @param zkLinkAddress zklink address
    /// @param subAccountId sub account id
    /// @param amount amount to deposit
    function claimDepositETHCallback(bytes32 zkLinkAddress, uint8 subAccountId, uint104 amount) external payable override onlyMessageService {
        require(msg.value == amount, "V0");

        (bool success, bytes memory errorInfo) = zklinkContract.call{value: msg.value}(abi.encodeCall(IZkLink.depositETH, (zkLinkAddress, subAccountId)));

        emit ClaimedDepositETH(zkLinkAddress, subAccountId, amount, success, errorInfo);
    }

    /// set linea ERC20 bridges of tokens
    /// @param _tokens L2 ERC20 token address
    /// @param _bridges L2 bridge addresses of tokens
    function setBridges(address[] calldata _tokens, address[] calldata _bridges) external onlyOwner {
        require(_tokens.length == _bridges.length, "P0");

        for (uint i = 0; i < _tokens.length; i++) {
            bridges[_tokens[i]] = _bridges[i];
            emit SetBridge(_tokens[i], _bridges[i]);
        }
    }

    /// set remote bridge address of token
    /// @param _tokens L2 ERC20 token addresses
    /// @param _remoteBridges L1 bridge addresses of L2 tokens
    function setRemoteBridges(address[] calldata _tokens, address[] calldata _remoteBridges) external onlyOwner {
        require(_tokens.length == _remoteBridges.length, "P0");

        for (uint i = 0; i < _tokens.length; i++) {
            remoteBridges[_tokens[i]] = _remoteBridges[i];
            emit SetRemoteBridge(_tokens[i], _remoteBridges[i]);
        }
    }

    /// set remote ERC20 token address of L2
    /// @param _tokens L2 ERC20 token addresses
    /// @param _remoteTokens L1 ERC20 token addresses of L2 ERC20 tokens
    function setRemoteTokens(address[] calldata _tokens, address[] calldata _remoteTokens) external onlyOwner {
        require(_tokens.length == _remoteTokens.length, "P0");

        for (uint i = 0; i < _tokens.length; i++) {
            remoteTokens[_tokens[i]] = _remoteTokens[i];
            emit SetRemoteToken(_tokens[i], _remoteTokens[i]);
        }
    }

    /// set remote gateway address
    /// @param _remoteGateway L1 gateway address
    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        require(_remoteGateway != address(0), "P0");

        remoteGateway = _remoteGateway;
    }

    /// set fee recipient address
    /// @param _feeRecipient fee recipient address who claim this message
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "P0");

        feeRecipient = payable(_feeRecipient);
    }

    /// get bridge address of ERC20 token
    /// @param token ERC20 token address of L2
    function getBridge(address token) external view returns (address) {
        return bridges[token];
    }

    /// get L1 bridge address of L2 ERC20 token
    /// @param token L2 ERC20 token address
    function getRemoteBridge(address token) external view returns (address) {
        return remoteBridges[token];
    }

    /// get L1 token address of L2 ERC20 token
    /// @param token L2 ERC20 token address
    function getRemoteToken(address token) external view returns (address) {
        return remoteTokens[token];
    }

    /// batch check whether messageHash can claim
    /// @param messageHashs: L1 messageHash
    function checkMessageStatus(bytes32[] calldata messageHashs) external view returns (uint256[] memory) {
        uint256[] memory status = new uint256[](messageHashs.length);
        for (uint i = 0; i < messageHashs.length; i++) {
            status[i] = messageService.inboxL1L2MessageStatus(messageHashs[i]);
        }
        return status;
    }
}
