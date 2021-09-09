// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ReentrancyGuard.sol";
import "./Storage.sol";
import "./Config.sol";
import "./Events.sol";
import "./IMappingToken.sol";

/// @title zkSync base contract
/// @author ZkLink Labs
contract ZkSyncBase is Storage, Config, Events, ReentrancyGuard {

    /// @notice Checks that current state not is exodus mode
    function requireActive() internal view {
        require(!exodusMode, "L"); // exodus mode activated
    }
}
