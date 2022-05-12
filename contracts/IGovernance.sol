// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Governance interface
/// @author zk.link
interface IGovernance {

    /// @notice Return the network governor address
    function networkGovernor() external view returns (address);

    /// @notice Check if bridge to enabled
    /// @param bridge the bridge contract
    function isBridgeToEnabled(address bridge) external view returns (bool);

    /// @notice Check if bridge from enabled
    /// @param bridge the bridge contract
    function isBridgeFromEnabled(address bridge) external view returns (bool);
}
