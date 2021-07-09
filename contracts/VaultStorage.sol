// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ZkSync.sol";
import "./Governance.sol";

/// @title zkLink vault storage contract
/// @author ZkLink Labs
contract VaultStorage {
    enum StrategyStatus { NONE, ADDED, ACTIVE, PREPARE_UPGRADE, EXIT }

    struct TokenVault {
        uint16 reserveRatio; // vault must reserve some token to satisfy user withdraw
        uint256 debt; // debt owned by vault from user deposit to L1 contract
        address strategy; // vault use strategy to earn token
        address nextStrategy; // next strategy while upgrade
        uint256 takeEffectTime; // strategy take effect time
        StrategyStatus status; // strategy status
    }
    /// @dev token(valid by governance) vault
    mapping(uint16 => TokenVault) tokenVaults;

    /// @dev zkSync contract
    ZkSync public zkSync;

    /// @dev governance contract which used to validate token
    Governance public governance;

    /// @dev profit from strategy will settle some to user reward address which will assign to every user lastly
    address public userRewardAddress;

    /// @dev profit from strategy will settle some to protocol reward address
    address public protocolRewardAddress;

    /// @dev reward ratio of profit from strategy to protocol reward address
    uint16 public protocolRewardRatio;
}
