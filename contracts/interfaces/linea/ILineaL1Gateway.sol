// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {ILineaGateway} from "./ILineaGateway.sol";
import {IL1Gateway} from "../IL1Gateway.sol";

interface ILineaL1Gateway is IL1Gateway, ILineaGateway {
    /// @notice Claim ETH callback from message service
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount to withdraw
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function claimETHCallback(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable;

    /// @notice Claim ERC20 callback from message service
    /// @param _isUSDC True when the native token is usdc
    /// @param _nativeToken The native token
    /// @param _owner The address received eth on L1
    /// @param _amount The amount to withdraw
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function claimERC20Callback(bool _isUSDC, address _nativeToken, address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external;

    /// @notice Claim sync hash callback from message service
    /// @param _syncHash The sync hash of slaver chain
    function claimSlaverSyncHashCallback(bytes32 _syncHash) external;

    /// @notice Claim sync hash callback from message service
    /// @param _blockNumber The block number
    /// @param _syncHash The sync hash of master chain
    function claimMasterSyncHashCallback(uint32 _blockNumber, bytes32 _syncHash) external;
}
