// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the crt reporter contract
/// @author ZkLink Labs
interface ICrtReporter {

    /// @notice return true if crt of chain at target l2 block number is verified
    /// @param _crtBlock crt block number of l2
    function isCrtVerified(uint32 _crtBlock) external view returns (bool);
}
