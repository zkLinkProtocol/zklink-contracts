// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the strategy contract
/// @author ZkLink Labs
interface IStrategy {

    /**
     * @dev Returns the amount of total assets in strategy according to token.
     */
    function totalAsset() external view returns (uint256);

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
