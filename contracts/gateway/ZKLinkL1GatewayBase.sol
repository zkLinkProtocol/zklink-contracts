// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import {IZkSync} from "../interfaces/IZkSync.sol";
import {ILineaERC20Bridge} from "../interfaces/ILineaERC20Bridge.sol";
import {IMessageService} from "../interfaces/IMessageService.sol";
import {ILineaGateway} from "../interfaces/ILineaGateway.sol";
import {IZKSyncGateway} from "../interfaces/IZKSyncGateway.sol";
import {IZKSyncL1Bridge} from "../interfaces/IZKSyncL1Bridge.sol";
import {IZKLinkL1Gateway} from "../interfaces/IZKLinkL1Gateway.sol";

abstract contract ZKLinkL1GatewayBase is Ownable, IZKLinkL1Gateway {
    /// @notice zksync l2TxGasPerPubdataByte
    uint256 public constant REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

    /// @notice if fee on, when bridge from ethereum to linea should pay l2 claim message gas fee
    bool public lineaFeeOn;
    bool public zksyncFeeOn;

    uint64 public lineaFee;
    uint64 public zksyncFee;

    // /// @notice amount of L2 claim message fees users should pay for
    // uint256 public fee;

    /// @notice linea message service address
    IMessageService public messageService;

    /// @dev Remote Gateway address
    mapping(Chains => address) internal remoteGateway;

    /// @dev Mapping from token to token bridge (only linea)
    mapping(address => address) internal bridges;

    /// @dev Mapping from token to remote bridge (only linea)
    mapping(address => address) internal remoteBridge;

    /// @dev Mapping L1 token address to L2 token address
    mapping(address => address) internal remoteTokens;

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

    function setFeeOnAndFee(
        Chains _chain,
        bool _feeOn,
        uint64 _fee
    ) external onlyOwner {
        if (_chain == Chains.Linea) {
            lineaFeeOn = _feeOn;
            lineaFee = _fee;
        } else if (_chain == Chains.ZKSync) {
            zksyncFeeOn = _feeOn;
            zksyncFee = _fee;
        }
        emit SetFeeOn(_chain, _feeOn, _fee);
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

    /// get remote gateway of zksync or linea
    /// @param _chain Chains.ZKSync or Chains.Linea
    function getRemoteGateway(Chains _chain) external view returns (address) {
        return remoteGateway[_chain];
    }

    /// withdraw fees
    /// @param receiver receiver address
    function withdrawFee(address payable receiver) external onlyOwner {
        receiver.transfer(address(this).balance);
    }
}
