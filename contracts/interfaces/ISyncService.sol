// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Sync service for sending cross chain message
/// @author zk.link
interface ISyncService {
    // #if CHAIN_ID != MASTER_CHAIN_ID
    /// @notice Send sync hash message to master chain
    /// @param blockNumber the block height
    /// @param syncHash the sync hash
    function sendSyncHash(uint32 blockNumber, bytes32 syncHash) external payable;
    // #endif

    // #if CHAIN_ID == MASTER_CHAIN_ID
    /// @notice Send block confirmation message to slaver chains
    /// @param blockNumber the block height
    function confirmBlock(uint32 blockNumber) external payable;
    // #endif
}
