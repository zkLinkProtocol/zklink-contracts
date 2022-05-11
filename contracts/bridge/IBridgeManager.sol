// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBridgeManager {

    /// @notice Check if bridge to enabled
    /// @param bridge the bridge contract
    function isBridgeToEnabled(address bridge) external view returns (bool);

    /// @notice Check if bridge from enabled
    /// @param bridge the bridge contract
    function isBridgeFromEnabled(address bridge) external view returns (bool);
}
