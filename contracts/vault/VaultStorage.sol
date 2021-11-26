// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkLink.sol";
import "../Governance.sol";

/// @title ZkLink vault storage contract
/// @author zk.link
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

    /// @dev ZkLink contract
    ZkLink public zkLink;

    /// @dev governance contract which used to validate token
    Governance public governance;
}
