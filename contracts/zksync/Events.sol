// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./Upgradeable.sol";
import "./Operations.sol";

/// @title zkSync events
/// @author Matter Labs
interface Events {
    /// @notice Event emitted when a block is committed
    event BlockCommit(uint32 indexed blockNumber);

    /// @notice Event emitted when a block is verified
    event BlockVerification(uint32 indexed blockNumber);

    /// @notice Event emitted when user funds are withdrawn from the zkSync contract
    event Withdrawal(uint16 indexed tokenId, uint128 amount);

    /// @notice Event emitted when user funds are deposited to the zkSync contract
    event Deposit(uint16 indexed tokenId, uint128 amount);

    /// @notice Event emitted when user funds are deposited and swap to the zkSync contract
    event QuickSwap(address indexed sender,
        uint128 amountIn,
        uint128 amountOutMin,
        uint16 fromTokenId,
        uint8 toChainId,
        uint16 toTokenId,
        address to,
        uint32 nonce,
        address pair,
        uint16 acceptTokenId,
        uint128 acceptAmountOutMin);

    /// @notice Event emitted when user mapping token
    event TokenMapping(uint16 indexed tokenId, uint128 amount, uint8 toChainId);

    /// @notice Event emitted when user add liquidity
    event AddLiquidity(address indexed pair, uint16 indexed tokenId, uint128 amount);

    /// @notice Event emitted when user remove liquidity
    event RemoveLiquidity(address indexed pair, uint16 indexed tokenId, uint128 lpAmount);

    /// @notice Event emitted when accepter accept a fast withdraw
    event Accept(address indexed accepter, address indexed receiver, uint16 indexed tokenId, uint128 amount);

    /// @notice Event emitted when user sends a authentication fact (e.g. pub-key hash)
    event FactAuth(address indexed sender, uint32 nonce, bytes fact);

    /// @notice Event emitted when blocks are reverted
    event BlocksRevert(uint32 totalBlocksVerified, uint32 totalBlocksCommitted);

    /// @notice Exodus mode entered event
    event ExodusMode();

    /// @notice New priority request event. Emitted when a request is placed into mapping
    event NewPriorityRequest(
        address sender,
        uint64 serialId,
        Operations.OpType opType,
        bytes pubData,
        uint256 expirationBlock
    );

    /// @notice Deposit committed event.
    event DepositCommit(
        uint32 indexed zkSyncBlockId,
        uint32 indexed accountId,
        address owner,
        uint16 indexed tokenId,
        uint128 amount
    );

    /// @notice Full exit committed event.
    event FullExitCommit(
        uint32 indexed zkSyncBlockId,
        uint32 indexed accountId,
        address owner,
        uint16 indexed tokenId,
        uint128 amount
    );
}

/// @title Upgrade events
/// @author Matter Labs
interface UpgradeEvents {
    /// @notice Event emitted when new upgradeable contract is added to upgrade gatekeeper's list of managed contracts
    event NewUpgradable(uint256 indexed versionId, address indexed upgradeable);

    /// @notice Upgrade mode enter event
    event NoticePeriodStart(
        uint256 indexed versionId,
        address[] newTargets,
        uint256 noticePeriod // notice period (in seconds)
    );

    /// @notice Upgrade mode cancel event
    event UpgradeCancel(uint256 indexed versionId);

    /// @notice Upgrade mode preparation status event
    event PreparationStart(uint256 indexed versionId);

    /// @notice Upgrade mode complete event
    event UpgradeComplete(uint256 indexed versionId, address[] newTargets);
}
