// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface ILineaL1Gateway {
    event Deposit(uint192 indexed txNonce, address token, uint256 amount, bytes32 zklinkAddress, uint8 subAccountId, bool _mapping);
    event SetFee(uint64 fee);
    event SetRemoteGateway(address remoteGateWay);
    event WithdrawFee(address receiver, uint256 amount);

    /// @notice Deposit ETH to zkLink on Linea
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;

    /// @notice Deposit ERC20 to zkLink on Linea
    /// @param _token The token on L1
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable;

    /// @notice Claim withdraw ETH callback from message service
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount to withdraw
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function claimWithdrawETHCallback(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable;

    /// @notice Claim Withdraw ERC20 callback from message service
    /// @param _isUSDC True when the native token is usdc
    /// @param _nativeToken The native token
    /// @param _owner The address received eth on L1
    /// @param _amount The amount to withdraw
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function claimWithdrawERC20Callback(bool _isUSDC, address _nativeToken, address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external;
}
