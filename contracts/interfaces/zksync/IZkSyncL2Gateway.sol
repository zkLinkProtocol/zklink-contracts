// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IL2Gateway} from "../IL2Gateway.sol";

interface IZkSyncL2Gateway is IL2Gateway {
    /// @notice Claim ETH
    /// @param _txNonce The deposit sequence of L1 gateway
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _amount The eth amount to deposit
    function claimETH(uint32 _txNonce, bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable;

    /// @notice Claim ERC20
    /// @param _txNonce The deposit sequence of L1 gateway
    /// @param _l1Token The token on ethereum
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function claimERC20(uint32 _txNonce, address _l1Token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external;
}
