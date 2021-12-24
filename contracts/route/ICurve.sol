// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Curve interface
/// @author zk.link
interface ICurve {

    /// @notice Deposit coins into the pool
    /// @param _amounts List of amounts of coins to deposit
    /// @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
    /// @return Amount of LP tokens received by depositing
    function add_liquidity(uint256[] memory _amounts, uint256 _min_mint_amount) external returns (uint256);
}
