// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/BitMapsUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IZKLinkL2Gateway} from "../interfaces/IZKLinkL2Gateway.sol";
import {IMessageService} from "../interfaces/IMessageService.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";

contract ZKLinkL2Gateway is
    OwnableUpgradeable,
    UUPSUpgradeable,
    IZKLinkL2Gateway
{
    uint8 public constant INBOX_STATUS_UNKNOWN = 0;
    uint8 public constant INBOX_STATUS_RECEIVED = 1;
    uint8 public constant INBOX_STATUS_CLAIMED = 2;

    // Claim fee recipient
    address payable public feeRecipient;

    // message service address
    IMessageService public messageService;

    // Remote Gateway address
    address public remoteGateway;

    address public zklinkContract;

    // Mapping from token to token bridge
    mapping(address => address) bridges;

    // Mapping from token to remote bridge
    mapping(address => address) remoteBridge;

    // Mapping L1 token address to L2 token address
    mapping(address => address) remoteTokens;

    // Mapping from messageHash to bool
    mapping(bytes32 => bool) messageHashUsed;

    bytes32 public messageHash;

    uint256[49] internal __gap;

    modifier onlyMessageService() {
        if (msg.sender != address(messageService)) {
            revert OnlyMessageService();
        }
        _;
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function claimDepositERC20(
        address _token,
        bytes calldata _calldata,
        uint256 _nonce,
        bytes calldata _cbCalldata,
        uint256 _cbNonce
    ) external override {
        messageHash = keccak256(
            abi.encode(
                remoteBridge[_token],
                bridges[_token],
                0,
                0,
                _nonce,
                _calldata
            )
        );

        uint256 status = messageService.inboxL1L2MessageStatus(messageHash);
        if (status == INBOX_STATUS_UNKNOWN) {
            revert UnknowMessage();
        }

        // if status == INBOX_STATUS_CLAIMED means someone else claimed erc20 token directly
        if (status == INBOX_STATUS_CLAIMED && messageHashUsed[messageHash]) {
            revert CanNotClaimTwice();
        }

        if (status == INBOX_STATUS_RECEIVED) {
            // claim erc20 token
            (bool success, bytes memory errorInfo) = address(messageService)
                .call(
                    abi.encodeCall(
                        IMessageService.claimMessage,
                        (
                            remoteBridge[_token],
                            bridges[_token],
                            0,
                            0,
                            feeRecipient,
                            _calldata,
                            _nonce
                        )
                    )
                );

            require(success, string(errorInfo));
        }

        // claim callback message to verify messages
        messageService.claimMessage(
            remoteGateway,
            address(this),
            0,
            0,
            feeRecipient,
            _cbCalldata,
            _cbNonce
        );
    }

    function claimDepositERC20Callback(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes32 _messageHash
    ) external override onlyMessageService {
        if (messageHash != _messageHash) {
            revert InvalidParmas();
        }

        // approve token to zklink
        IERC20Upgradeable(_token).approve(zklinkContract, _amount);

        // deposit erc20 to zklink
        (bool success, bytes memory errorInfo) = zklinkContract.call(
            abi.encodeCall(
                IZkLink.depositERC20,
                (
                    IERC20(_token),
                    _amount,
                    _zkLinkAddress,
                    _subAccountId,
                    _mapping
                )
            )
        );

        if (success) {
            messageHashUsed[messageHash] = true;
        }

        // reset messageHash
        messageHash = bytes32(0);

        emit ClaimedDepositERC20(
            _token,
            _amount,
            _zkLinkAddress,
            _subAccountId,
            _mapping,
            success,
            errorInfo
        );
    }

    function claimDepositETH(
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        uint104 amount
    ) external payable override onlyMessageService {
        if (msg.value != amount) {
            revert InvalidValue();
        }
        (bool success, bytes memory errorInfo) = zklinkContract.call{
            value: msg.value
        }(abi.encodeCall(IZkLink.depositETH, (zkLinkAddress, subAccountId)));

        emit ClaimedDepositETH(
            zkLinkAddress,
            subAccountId,
            amount,
            success,
            errorInfo
        );
    }

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

    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        if (_remoteGateway == address(0)) {
            revert InvalidParmas();
        }

        remoteGateway = _remoteGateway;
    }

    function setMessageService(address _messageService) external onlyOwner {
        if (_messageService == address(0)) {
            revert InvalidParmas();
        }

        messageService = IMessageService(_messageService);
    }

    function setZKLink(address _zklinkContract) external onlyOwner {
        if (_zklinkContract == address(0)) {
            revert InvalidParmas();
        }
        zklinkContract = _zklinkContract;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) {
            revert InvalidParmas();
        }
        feeRecipient = payable(_feeRecipient);
    }

    function getBridge(address token) external view returns (address) {
        return bridges[token];
    }

    function getRemoteBridge(address token) external view returns (address) {
        return remoteBridge[token];
    }

    function getRemoteToken(address token) external view returns (address) {
        return remoteTokens[token];
    }
}
