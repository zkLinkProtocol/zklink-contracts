// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkSync.sol";
import "../Governance.sol";

/// @title zkLink vault storage contract
/// @author ZkLink Labs
contract VaultStorage {
    enum StrategyStatus { NONE, ADDED, ACTIVE, PREPARE_UPGRADE, EXIT }

    struct TokenVault {
        address strategy; // vault use strategy to earn token
        address nextStrategy; // next strategy while upgrade
        uint256 takeEffectTime; // strategy take effect time
        StrategyStatus status; // strategy status
    }
    /// @dev token(valid by governance) vault
    mapping(uint16 => TokenVault) public tokenVaults;

    /// @dev zkSync contract
    ZkSync public zkSync;

    /// @dev governance contract which used to validate token
    Governance public governance;
}
