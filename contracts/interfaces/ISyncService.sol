// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Sync service for sending cross chain message
/// @author zk.link
interface ISyncService {
    /// @notice Return the fee of sending sync hash to master chain
    /// @param masterChainId the master chain id defined by zkLink
    /// @param syncHash the sync hash
    function estimateSendSyncHashFee(uint8 masterChainId, bytes32 syncHash) external view returns (uint nativeFee);

    /// @notice Send sync hash message to master chain
    /// @param masterChainId the master chain id defined by zkLink
    /// @param syncHash the sync hash
    function sendSyncHash(uint8 masterChainId, bytes32 syncHash) external payable;

    /// @notice Estimate the fee of sending confirm block message to slaver chain
    /// @param destZkLinkChainId the destination chain id defined by zkLink
    /// @param blockNumber the height of stored block
    function estimateConfirmBlockFee(uint8 destZkLinkChainId, uint32 blockNumber) external view returns (uint nativeFee);

    /// @notice Send block confirmation message to slaver chains
    /// @param destZkLinkChainId the destination chain id defined by zkLink
    /// @param blockNumber the block height
    function confirmBlock(uint8 destZkLinkChainId, uint32 blockNumber) external payable;
}
