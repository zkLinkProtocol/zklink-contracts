// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IL1Gateway {
    /// @notice Deposit ETH to zkLink on L2
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;

    /// @notice Deposit ERC20 to zkLink on L2
    /// @param _token The token on L1
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable;

    /// @notice Return the fee of sending block confirmation
    /// @param blockNumber the block number
    function estimateConfirmBlockFee(uint32 blockNumber) external view returns (uint nativeFee);

    /// @notice Send block confirmation message to L2 gateway
    /// @param blockNumber the block number
    function confirmBlock(uint32 blockNumber) external payable;
}
