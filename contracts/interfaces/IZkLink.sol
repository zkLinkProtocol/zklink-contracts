// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZkLink interface contract
/// @author zk.link
interface IZkLink {
    /// @notice Return the network governor
    function networkGovernor() external view returns (address);

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    function depositERC20(IERC20 _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external;

    /// @notice Receive block sync hash from slaver chain
    function receiveSyncHash(uint32 blockNumber, uint8 chainId, bytes32 syncHash) external;

    /// @notice Receive block confirmation from master chain
    function receiveBlockConfirmation(uint32 blockNumber) external;

    /// @notice Withdraw token to L1 for user by gateway
    /// @param owner User receive token on L1
    /// @param token Token address
    /// @param amount The amount(recovered decimals) of withdraw operation
    /// @param fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    /// @param accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param subAccountIdOfNonce SubAccount that supply nonce
    /// @param nonce SubAccount nonce, used to produce unique accept info
    function withdrawToL1(address owner, address token, uint128 amount, uint16 fastWithdrawFeeRate, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce) external payable;

    /// @notice  Withdraws tokens from zkLink contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _tokenId Token id
    /// @param _amount Amount to withdraw to request.
    /// @return The actual withdrawn amount
    /// @dev NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token zkLink contract
    /// balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    function withdrawPendingBalance(address payable _owner, uint16 _tokenId, uint128 _amount) external returns (uint128);
}
