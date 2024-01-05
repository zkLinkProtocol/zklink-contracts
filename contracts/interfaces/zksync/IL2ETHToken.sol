// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @author Matter Labs
interface IL2ETHToken {
    /// @notice Initiate the ETH withdrawal, funds will be available to claim on L1 `finalizeEthWithdrawal` method.
    /// @param _l1Receiver The address on L1 to receive the funds.
    function withdraw(address _l1Receiver) external payable;
}
