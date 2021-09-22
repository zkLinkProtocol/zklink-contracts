// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ReentrancyGuard.sol";
import "./Storage.sol";
import "./Config.sol";
import "./Events.sol";
import "./IMappingToken.sol";
import "./SafeMath.sol";
import "./SafeMathUInt128.sol";

/// @title zkSync base contract
/// @author ZkLink Labs
contract ZkSyncBase is Storage, Config, Events, ReentrancyGuard {
    using SafeMathUInt128 for uint128;

    /// @notice Checks that current state not is exodus mode
    function requireActive() internal view {
        require(!exodusMode, "L"); // exodus mode activated
    }

    function increaseBalanceToWithdraw(bytes22 _packedBalanceKey, uint128 _amount) internal {
        uint128 balance = pendingBalances[_packedBalanceKey].balanceToWithdraw;
        pendingBalances[_packedBalanceKey] = PendingBalance(balance.add(_amount), FILLED_GAS_RESERVE_VALUE);
    }
}
