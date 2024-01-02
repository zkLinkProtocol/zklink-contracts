// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IL1Gateway {
    /// @notice Return the fee of sending block confirmation
    /// @param blockNumber the block number
    function estimateConfirmBlockFee(uint32 blockNumber) external view returns (uint nativeFee);

    /// @notice Send block confirmation message to L2 gateway
    /// @param blockNumber the block number
    function confirmBlock(uint32 blockNumber) external payable;
}
