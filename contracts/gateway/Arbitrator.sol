// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IL1Gateway.sol";
import "../zksync/Config.sol";
import "../zksync/Utils.sol";
import {IArbitrator} from "../interfaces/IArbitrator.sol";

/// @title Arbitrator contract
/// @author zk.link
contract Arbitrator is Config, OwnableUpgradeable, UUPSUpgradeable, IArbitrator{
    /// @dev L1 gateway of chains
    /// chainId => l1 gateway
    mapping(uint8 => IL1Gateway) public chainL1GatewayMap;
    /// l1 gateway => chainId
    mapping(address => uint8) public l1GatewayChainMap;

    /// @dev Store sync hash for slaver chains
    /// chainId => syncHash
    mapping(uint8 => bytes32) public synchronizedChains;

    /// @dev Store sync hash for master chain
    /// blockNumber => syncHash of all slaver chains
    mapping(uint32 => bytes32) public blockSyncHashes;

    /// @notice Gateway changed
    event SetGateway(uint8 chainId, address newGateway);

    /// @notice Event emitted when receive sync hash from a slaver chain
    event ReceiveSlaverSyncHash(uint8 chainId, bytes32 syncHash);

    /// @notice Event emitted when receive sync hash from master chain
    event ReceiveMasterSyncHash(uint32 blockNumber, bytes32 syncHash);

    /// @notice Event emitted when send sync message
    event SynchronizationFee(uint256 fee);

    /// @notice Event emitted when a block is synced
    event BlockSynced(uint32 blockNumber);

    function initialize() external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Set gateway address
    /// @param _gateway new gateway address
    function setGateway(uint8 chainId, IL1Gateway _gateway) external onlyOwner {
        chainL1GatewayMap[chainId] = _gateway;
        l1GatewayChainMap[address(_gateway)] = chainId;
        emit SetGateway(chainId, address(_gateway));
    }

    function receiveSlaverSyncHash(bytes32 syncHash) external override {
        uint8 chainId = l1GatewayChainMap[msg.sender];
        require(chainId > 0, "Caller is not slaver chain l1 gateway");
        synchronizedChains[chainId] = syncHash;
        emit ReceiveSlaverSyncHash(chainId, syncHash);
    }

    function receiveMasterSyncHash(uint32 blockNumber, bytes32 syncHash) external override {
        uint8 chainId = l1GatewayChainMap[msg.sender];
        require(chainId == MASTER_CHAIN_ID, "Caller is not master chain l1 gateway");
        blockSyncHashes[blockNumber] = syncHash;
        emit ReceiveMasterSyncHash(blockNumber, syncHash);
    }

    /// @notice Check if received all syncHash from other chains at the block height
    function isBlockConfirmable(uint32 blockNumber) public view returns (bool) {
        bytes32 syncHash = EMPTY_STRING_KECCAK;
        for (uint8 chainId = MIN_CHAIN_ID; chainId <= MAX_CHAIN_ID; ++chainId) {
            uint256 chainIndex = 1 << chainId - 1;
            if (chainIndex & ALL_CHAINS == chainIndex) {
                if (chainId == MASTER_CHAIN_ID) {
                    continue;
                }
                bytes32 slaverChainSyncHash = synchronizedChains[chainId];
                if (slaverChainSyncHash == bytes32(0)) {
                    slaverChainSyncHash = EMPTY_STRING_KECCAK;
                }
                syncHash = Utils.concatTwoHash(syncHash, slaverChainSyncHash);
            }
        }
        return blockSyncHashes[blockNumber] == syncHash;
    }

    /// @notice Send block confirmation message to chains at the block height
    function confirmBlock(uint32 blockNumber) external payable {
        require(isBlockConfirmable(blockNumber), "Block can not confirm");

        // send confirm message to slaver chains
        uint256 leftMsgValue = msg.value;
        uint256 totalNativeFee = 0;
        for (uint8 chainId = MIN_CHAIN_ID; chainId <= MAX_CHAIN_ID; ++chainId) {
            uint256 chainIndex = 1 << chainId - 1;
            if (chainIndex & ALL_CHAINS == chainIndex) {
                IL1Gateway gateway = chainL1GatewayMap[chainId];
                uint256 nativeFee = gateway.estimateConfirmBlockFee(blockNumber);
                require(leftMsgValue >= nativeFee, "Not enough fee");
                gateway.confirmBlock{value:nativeFee}(blockNumber);
                leftMsgValue -= nativeFee;
                totalNativeFee += nativeFee;
            }
        }

        if (leftMsgValue > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = msg.sender.call{value: leftMsgValue}("");
            require(success, "Send left fee failed");
        }

        // log the fee payed to sync service
        emit SynchronizationFee(totalNativeFee);
        emit BlockSynced(blockNumber);
    }
}