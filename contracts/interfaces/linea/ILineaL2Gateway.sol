// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IL2Gateway} from "../IL2Gateway.sol";
import {ILineaGateway} from "./ILineaGateway.sol";

interface ILineaL2Gateway is ILineaGateway, IL2Gateway {
    /// @notice Claim ETH callback from message service
    /// @param _txNonce The deposit sequence of L1 gateway
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _amount The eth amount to deposit
    function claimETHCallback(uint32 _txNonce, bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable;

    /// @notice Claim ERC20 callback from message service
    /// @param _txNonce The deposit sequence of L1 gateway
    /// @param _isUSDC True when the native token is usdc
    /// @param _nativeToken The native token
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function claimERC20Callback(uint32 _txNonce, bool _isUSDC, address _nativeToken, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external;

    /// @notice Claim block confirmation callback from message service
    /// @param _blockNumber The confirmed block number
    function claimBlockConfirmationCallback(uint32 _blockNumber) external;
}
