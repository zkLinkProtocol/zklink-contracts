// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IL2Gateway {
    /// @notice Withdraw ETH to L1 for owner
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount received
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function withdrawETH(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable;

    /// @notice Withdraw ERC20 token to L1 for owner
    /// @dev gateway need to pay fee to message service
    /// @param _owner The address received token on L1
    /// @param _token The token address on L2
    /// @param _amount The token amount received
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function withdrawERC20(address _owner, address _token, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable;
}
