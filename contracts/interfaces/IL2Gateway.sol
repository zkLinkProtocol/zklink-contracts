// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IL2Gateway {
    /// @notice Estimate the fee to call send withdraw message
    function estimateWithdrawETHFee(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external view returns (uint256 nativeFee);

    /// @notice Withdraw ETH to L1 for owner
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount received
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function withdrawETH(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable;

    /// @notice Estimate the fee to call send withdraw message
    function estimateWithdrawERC20Fee(address _owner, address _token, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external view returns (uint256 nativeFee);

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

    /// @notice Return the fee of sending sync hash to ethereum
    /// @param syncHash the sync hash
    function estimateSendSlaverSyncHashFee(bytes32 syncHash) external view returns (uint nativeFee);

    /// @notice Send sync hash message to ethereum
    /// @param syncHash the sync hash
    function sendSlaverSyncHash(bytes32 syncHash) external payable;

    /// @notice Return the fee of sending sync hash to ethereum
    /// @param blockNumber the block number
    /// @param syncHash the sync hash
    function estimateSendMasterSyncHashFee(uint32 blockNumber, bytes32 syncHash) external view returns (uint nativeFee);

    /// @notice Send sync hash message to ethereum
    /// @param blockNumber the block number
    /// @param syncHash the sync hash
    function sendMasterSyncHash(uint32 blockNumber, bytes32 syncHash) external payable;

    /// @notice Claim block confirmation from message service
    /// @param _blockNumber The confirmed block number
    function claimBlockConfirmation(uint32 _blockNumber) external;
}
