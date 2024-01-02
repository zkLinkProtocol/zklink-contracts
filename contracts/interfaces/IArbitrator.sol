// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IArbitrator {
    /// @notice Receive sync hash from L1 gateway of slaver chain
    function receiveSlaverSyncHash(bytes32 syncHash) external;

    /// @notice Receive sync hash from L1 gateway of master chain
    function receiveMasterSyncHash(uint32 blockNumber, bytes32 syncHash) external;
}
