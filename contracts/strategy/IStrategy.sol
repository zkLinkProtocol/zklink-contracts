// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the strategy contract
/// @author zk.link
/// @notice IStrategy implement must has default receive function
interface IStrategy {

    /**
     * @notice Returns vault contract address.
     */
    function vault() external view returns (address);

    /**
     * @notice Returns token id strategy want to invest.
     */
    function want() external view returns (uint16);

    /**
     * @notice Returns token strategy want to invest.
     */
    function wantToken() external view returns (address);

    /**
    * @notice Response on vault deposit token to strategy
    */
    function deposit() external;

    /**
     * @notice Withdraw `amountNeeded` token to vault
     * @param amountNeeded amount need to withdraw from strategy
     */
    function withdraw(uint256 amountNeeded) external;

    /**
     * @notice Harvest reward tokens.
     */
    function rewardTokens() external view returns (address[] memory);

    /**
     * @notice Harvest reward tokens to pool.
     * @return amounts of each reward token
     */
    function harvest() external returns (uint256[] memory);

    /**
     * @notice Migrate all assets to `_newStrategy`.
     */
    function migrate(address _newStrategy) external;

    /**
     * @notice Response after old strategy migrate all assets to this new strategy
     */
    function onMigrate() external;

    /**
     * @notice Emergency exit from strategy, all assets will return back to vault regardless of loss
     */
    function emergencyExit() external;
}
