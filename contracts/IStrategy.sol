// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the strategy contract
/// @author ZkLink Labs
/// @notice IStrategy implement must has default receive function
interface IStrategy {

    /**
     * @notice Returns the net value of want token in strategy
     * There are three kinds of strategy:
     * 1. want and reward token are the same, net value grows with time, no harvest
     * 2. want and reward token are different, want net value keep constant and reward token are transferred to vault after harvest
     * 3. want and reward token are different, want net value grows with time and reward token are transferred to vault after harvest
     */
    function wantNetValue() external view returns (uint256);

    /**
     * @notice Returns vault contract address.
     */
    function vault() external view returns (address);

    /**
     * @notice Returns token id strategy want to invest.
     */
    function want() external view returns (uint16);

    /**
    * @notice Response on vault deposit token to strategy
    */
    function deposit() external;

    /**
     * @notice Withdraw `amountNeeded` token to vault(may produce some loss). Token amount return back from strategy may be a little more than
     * amountNeeded. amountNeeded <= amountActuallyTransferredToVault + loss
     * @param amountNeeded amount need to withdraw from strategy
     * @return loss that happened in withdraw
     */
    function withdraw(uint256 amountNeeded) external returns (uint256);

    /**
     * @notice Harvest reward tokens to vault.
     */
    function harvest() external;

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
