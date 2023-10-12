// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IL2Gateway {
    /// @notice Withdraw ETH to L1 for owner
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount received
    /// @param _withdrawHash The withdraw data hash
    function withdrawETH(address _owner, uint128 _amount, bytes32 _withdrawHash) external payable;

    /// @notice Withdraw ERC20 token to L1 for owner
    /// @dev gateway need to pay fee to message service
    /// @param _owner The address received token on L1
    /// @param _token The token address on L2
    /// @param _amount The token amount received
    /// @param _withdrawHash The withdraw data hash
    function withdrawERC20(address _owner, address _token, uint128 _amount, bytes32 _withdrawHash) external payable;
}
