// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./Upgradeable.sol";
import "./Operations.sol";

/// @title zkSync events
/// @author Matter Labs
interface Events {
    /// @notice Event emitted when a block is committed
    event BlockCommit(uint32 indexed blockNumber);

    /// @notice Event emitted when a block is proven
    event BlockProven(uint32 indexed blockNumber);

    /// @notice Event emitted when a block is synced
    event BlockSynced(uint32 indexed blockNumber);

    /// @notice Event emitted when a block is executed
    event BlockExecuted(uint32 indexed blockNumber);

    /// @notice Event emitted when user funds are withdrawn from the zkLink state and contract
    event Withdrawal(uint16 indexed tokenId, uint128 amount);

    /// @notice Event emitted when user funds are withdrawn from the zkLink state but not from contract
    event WithdrawalPending(uint16 indexed tokenId, bytes32 indexed recepient, uint128 amount);

    /// @notice Event emitted when user funds are withdrawn from the zkLink state to L1 and contract
    event WithdrawalL1(bytes32 indexed withdrawHash);

    /// @notice Event emitted when user funds are withdrawn from the zkLink state to L1 but not from contract
    event WithdrawalPendingL1(bytes32 indexed withdrawHash);

    /// @notice Event emitted when user sends a authentication fact (e.g. pub-key hash)
    event FactAuth(address indexed sender, uint32 nonce, bytes fact);

    /// @notice Event emitted when authentication fact reset clock start
    event FactAuthResetTime(address indexed sender, uint32 nonce, uint256 time);

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

    /// @notice Token added to ZkLink net
    /// @dev log token decimals on this chain to let L2 know(token decimals maybe different on different chains)
    event NewToken(uint16 indexed tokenId, address indexed token, uint8 decimals);

    /// @notice Governor changed
    event NewGovernor(address newGovernor);

    /// @notice Validator's status changed
    event ValidatorStatusUpdate(address indexed validatorAddress, bool isActive);

    /// @notice Token pause status update
    event TokenPausedUpdate(uint16 indexed token, bool paused);

    // #if SYNC_TYPE == 1
    /// @notice Sync service changed
    event SetSyncService(uint8 chainId, address newSyncService);
    // #endif

    /// @notice Gateway address changed
    event SetGateway(address indexed newGateway);

    // #if CHAIN_ID != MASTER_CHAIN_ID
    /// @notice Event emitted when send sync hash to master chain
    event SendSyncHash(bytes32 syncHash);
    // #endif

    // #if (CHAIN_ID == MASTER_CHAIN_ID) && (SYNC_TYPE == 1)
    /// @notice Event emitted when receive sync hash from a slaver chain
    event ReceiveSyncHash(uint8 slaverChainId, bytes32 syncHash);
    // #endif

    // #if SYNC_TYPE != 0
    /// @notice Event emitted when send sync message
    event SynchronizationFee(uint256 fee);
    // #endif
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

    /// @notice Upgrade mode complete event
    event UpgradeComplete(uint256 indexed versionId, address[] newTargets);
}
