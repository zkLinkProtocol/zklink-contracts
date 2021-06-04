// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ReentrancyGuard.sol";
import "./SafeMath.sol";
import "./SafeMathUInt128.sol";
import "./SafeCast.sol";
import "./Utils.sol";

import "./Storage.sol";
import "./Config.sol";
import "./Events.sol";
import "./PairTokenManager.sol";

/// @title zkSync base contract
/// @author ZkLink Labs
contract ZkSyncBase is PairTokenManager, Storage, Config, Events, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

    /// @notice Sends tokens
    /// @dev NOTE: will revert if transfer call fails or rollup balance difference (before and after transfer) is bigger than _maxAmount
    /// @dev This function is used to allow tokens to spend zkSync contract balance up to amount that is requested
    /// @param _token Token address
    /// @param _to Address of recipient
    /// @param _amount Amount of tokens to transfer
    /// @param _maxAmount Maximum possible amount of tokens to transfer to this account
    function _transferERC20(
        IERC20 _token,
        address _to,
        uint128 _amount,
        uint128 _maxAmount
    ) external returns (uint128 withdrawnAmount) {
        require(msg.sender == address(this), "5"); // wtg10 - can be called only from this contract as one "external" call (to revert all this function state changes if it is needed)

        uint16 lpTokenId = tokenIds[address(_token)];
        if (lpTokenId > 0) {
            validatePairTokenAddress(address(_token));
            pairManager.mint(address(_token), _to, _amount);
            return _amount;
        } else {
            uint256 balanceBefore = _token.balanceOf(address(this));
            require(Utils.sendERC20(_token, _to, _amount), "6"); // 6 - ERC20 transfer fails
            uint256 balanceAfter = _token.balanceOf(address(this));
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            require(balanceDiff <= _maxAmount, "7"); // wtg12 - rollup balance difference (before and after transfer) is bigger than _maxAmount

            return SafeCast.toUint128(balanceDiff);
        }
    }

    /// @notice Checks that current state not is exodus mode
    function requireActive() internal view {
        require(!exodusMode, "L"); // exodus mode activated
    }
}
