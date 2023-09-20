// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/BitMapsUpgradeable.sol";
import "../interfaces/ILineaERC20Bridge.sol";
import "../interfaces/IMessageService.sol";
import "../interfaces/IZKLinkL2Gateway.sol";

import {IZKLinkL1Gateway} from "../interfaces/IZKLinkL1Gateway.sol";

contract ZKLinkL1Gateway is
    OwnableUpgradeable,
    UUPSUpgradeable,
    IZKLinkL1Gateway
{
    bool public feeOn;

    uint256 public fee;

    // message service address
    IMessageService public messageService;

    // Remote Gateway address
    address public remoteGateway;

    // Mapping from token to token bridge
    mapping(address => address) bridges;

    // Mapping from token to remote bridge
    mapping(address => address) remoteBridge;

    // Mapping L1 token address to L2 token address
    mapping(address => address) remoteTokens;

    uint256[49] private __gap;

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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

        IERC20Upgradeable(_token).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        IERC20Upgradeable(_token).approve(bridges[_token], _amount);

        // deposit erc20
        uint256 nonce = messageService.nextMessageNumber();
        bytes memory _calldata = abi.encodeCall(
            ILineaERC20Bridge.receiveFromOtherLayer,
            (remoteGateway, _amount)
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

        ILineaERC20Bridge(bridges[_token]).depositTo(_amount, remoteGateway);

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            IZKLinkL2Gateway.claimDepositERC20Callback,
            (
                remoteTokens[_token],
                _amount,
                _zkLinkAddress,
                _subAccountId,
                _mapping,
                messageHash
            )
        );
        messageService.sendMessage(remoteGateway, 0, verifyCalldata);
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
            IZKLinkL2Gateway.claimDepositETH,
            (_zkLinkAddress, _subAccountId, uint104(msg.value))
        );

        messageService.sendMessage{value: msg.value}(
            remoteGateway,
            0,
            _calldata
        );
        emit DepositETH(_zkLinkAddress, _subAccountId, uint104(msg.value));
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

    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        if (_remoteGateway == address(0)) {
            revert InvalidParmas();
        }

        remoteGateway = _remoteGateway;
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

    function setMessageService(address _messageService) external onlyOwner {
        if (_messageService == address(0)) {
            revert InvalidParmas();
        }

        messageService = IMessageService(_messageService);
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

    receive() external payable {
        revert NotReceiveETHDirectly();
    }
}
