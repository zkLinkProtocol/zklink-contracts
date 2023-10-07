// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ILineaERC20Bridge} from "../interfaces/ILineaERC20Bridge.sol";
import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/IMessageService.sol";
import {ILineaL1Gateway} from "../interfaces/ILineaL1Gateway.sol";

contract LineaL1Gateway is Ownable, ILineaL1Gateway {
    bool public feeOn;

    /// @notice amount of L2 claim message fees users should pay for
    uint64 public fee;

    uint184 public txNonce;

    /// @notice linea message service address
    IMessageService public messageService;

    /// @dev Remote Gateway address
    address public remoteGateway;

    /// @dev Mapping from token to token bridge (only linea)
    mapping(address => address) internal bridges;

    /// @dev Mapping from token to remote bridge (only linea)
    mapping(address => address) internal remoteBridge;

    /// @dev Mapping L1 token address to L2 token address
    mapping(address => address) internal remoteTokens;

    modifier zeroAddressCheck(address addressToSet) {
        if (addressToSet == address(0)) {
            revert InvalidParmas();
        }
        _;
    }

    constructor(IMessageService _messageService) {
        messageService = _messageService;
    }

    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override {
        if (feeOn && msg.value != fee) {
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
        bytes memory _calldata = abi.encodeCall(ILineaERC20Bridge.receiveFromOtherLayer, (remoteGateway, _amount));
        bytes32 messageHash = keccak256(abi.encode(bridges[_token], remoteBridge[_token], 0, 0, nonce, _calldata));

        ILineaERC20Bridge(bridges[_token]).depositTo(_amount, remoteGateway);

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            ILineaL2Gateway.claimDepositERC20Callback,
            (remoteTokens[_token], _amount, _zkLinkAddress, _subAccountId, _mapping, messageHash)
        );
        messageService.sendMessage(remoteGateway, 0, verifyCalldata);

        txNonce++;
        emit DepositERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, _calldata, nonce, messageHash, txNonce);
    }

    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override {
        require(msg.value < 2 ** 128, "16");
        uint104 amount = feeOn ? uint104(msg.value) - fee : uint104(msg.value);

        bytes memory _calldata = abi.encodeCall(ILineaL2Gateway.claimDepositETH, (_zkLinkAddress, _subAccountId, amount));

        messageService.sendMessage{value: msg.value}(remoteGateway, 0, _calldata);

        txNonce++;
        emit DepositETH(_zkLinkAddress, _subAccountId, amount, txNonce);
    }

    function setFeeOnAndFee(bool _feeOn, uint64 _fee) external onlyOwner {
        feeOn = _feeOn;
        fee = _fee;
        emit SetFeeOn(_feeOn, _fee);
    }

    /// @notice set linea ERC20 bridges of L1
    /// @param _tokens L1 ERC20 tokens
    /// @param _bridges L1 bridges of ERC20 tokens
    function setBridges(address[] calldata _tokens, address[] calldata _bridges) external onlyOwner {
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
    function setRemoteBridges(address[] calldata _tokens, address[] calldata _remoteBridges) external onlyOwner {
        if (_tokens.length != _remoteBridges.length) {
            revert InvalidParmas();
        }

        for (uint i = 0; i < _tokens.length; i++) {
            remoteBridge[_tokens[i]] = _remoteBridges[i];
            emit SetRemoteBridge(_tokens[i], _remoteBridges[i]);
        }
    }

    /// @notice set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external zeroAddressCheck(_remoteGateway) onlyOwner {
        remoteGateway = _remoteGateway;
    }

    /// set L2 ERC20 tokens of L1
    /// @param _tokens linea L1 ERC20 tokens
    /// @param _remoteTokens linea L2 ERC20 tokens
    function setRemoteTokens(address[] calldata _tokens, address[] calldata _remoteTokens) external onlyOwner {
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
    function setMessageService(address _messageService) external zeroAddressCheck(_messageService) onlyOwner {
        messageService = IMessageService(_messageService);
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

    /// withdraw fees
    /// @param receiver receiver address
    function withdrawFee(address payable receiver) external onlyOwner {
        receiver.transfer(address(this).balance);
    }
}
