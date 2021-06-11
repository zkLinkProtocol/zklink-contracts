// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the strategy contract
/// @author ZkLink Labs
interface IStrategy {

    /**
     * @dev Returns the net value of want token in strategy
     * There are three kinds of strategy:
     * 1. want and reward token are the same, net value grows with time, no harvest
     * 2. want and reward token are different, want net value keep constant and reward token are transferred to vault after harvest
     * 3. want and reward token are different, want net value grows with time and reward token are transferred to vault after harvest
     */
    function wantNetValue() external view returns (uint256);

    /**
     * @dev Returns vault contract address.
     */
    function vault() external view returns (address);

    /**
     * @dev Returns token id strategy want to invest.
     */
    function want() external view returns (uint16);

    /**
     * @dev Withdraw `amountNeeded` token to vault(may produce some loss). amountNeeded = amountActuallyTransferredToVault + loss
     */
    function withdraw(uint256 amountNeeded) external returns (uint256);

    /**
     * @dev Migrate all assets to `_newStrategy`.
     */
    function migrate(address _newStrategy) external;
}
