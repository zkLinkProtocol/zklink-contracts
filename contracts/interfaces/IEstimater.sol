// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Estimate fee for sending cross chain message
/// @author zk.link
interface IEstimater {
    // #if CHAIN_ID != MASTER_CHAIN_ID
    /// @notice Estimate send sync hash fee
    /// @param syncHash the sync hash of stored block
    function estimateSendSyncHashFee(bytes32 syncHash) external view returns (uint nativeFee, uint protocolFee);
    // #endif

    // #if CHAIN_ID == MASTER_CHAIN_ID
    /// @notice Estimate the total fee of sending confirm block message to all slaver chains
    /// @param blockNumber the height of stored block
    function estimateConfirmBlockFee(uint32 blockNumber) external view returns (uint totalNativeFee, uint totalProtocolFee);
    // #endif
}
