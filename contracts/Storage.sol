// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Verifier.sol";
import "./ZkLinkPeriphery.sol";
import "./IZkLink.sol";

/// @title ZkLink storage contract
/// @dev Be carefully to change the order of variables
/// @author zk.link
contract Storage is Config, IZkLink {
    // verifier(20 bytes) + totalBlocksExecuted(4 bytes) + firstPriorityRequestId(8 bytes) stored in the same slot

    /// @notice Verifier contract. Used to verify block proof and exit proof
    Verifier public verifier;

    /// @notice Total number of executed blocks i.e. blocks[totalBlocksExecuted] points at the latest executed block (block 0 is genesis)
    uint32 public override totalBlocksExecuted;

    /// @notice First open priority request id
    uint64 public override firstPriorityRequestId;

    // governance(20 bytes) + totalBlocksCommitted(4 bytes) + totalOpenPriorityRequests(8 bytes) stored in the same slot

    /// @notice Governance contract. Contains the governor (the owner) of whole system, validators list, possible tokens list
    Governance public override governance;

    /// @notice Total number of committed blocks i.e. blocks[totalBlocksCommitted] points at the latest committed block
    uint32 public totalBlocksCommitted;

    /// @notice Total number of requests
    uint64 public totalOpenPriorityRequests;

    // periphery(20 bytes) + totalBlocksProven(4 bytes) + totalCommittedPriorityRequests(8 bytes) stored in the same slot

    /// @notice Periphery contract. Contains some auxiliary features
    ZkLinkPeriphery public periphery;

    /// @notice Total blocks proven.
    uint32 public override totalBlocksProven;

    /// @notice Total number of committed requests.
    /// @dev Used in checks: if the request matches the operation on Rollup contract and if provided number of requests is not too big
    uint64 public override totalCommittedPriorityRequests;

    /// @notice Flag indicates that exodus (mass exit) mode is triggered
    /// @notice Once it was raised, it can not be cleared again, and all users must exit
    bool public override exodusMode;

    /// @dev Root-chain balances (per owner and token id, see packAddressAndTokenId) to withdraw
    mapping(bytes22 => uint128) internal pendingBalances;

    /// @notice Flag indicates that a user has exited in the exodus mode certain token balance (accountId => subAccountId => tokenId)
    mapping(uint32 => mapping(uint8 => mapping(uint16 => bool))) public performedExodus;

    /// @dev Priority Requests mapping (request id - operation)
    /// Contains op type, pubdata and expiration block of unsatisfied requests.
    /// Numbers are in order of requests receiving
    mapping(uint64 => Operations.PriorityOperation) internal priorityRequests;

    /// @notice User authenticated fact hashes for some nonce.
    mapping(address => mapping(uint32 => bytes32)) public authFacts;

    /// @dev Timer for authFacts entry reset (address, nonce -> timer).
    /// Used when user wants to reset `authFacts` for some nonce.
    mapping(address => mapping(uint32 => uint256)) internal authFactsResetTimer;

    /// @dev Stored hashed StoredBlockInfo for some block number
    mapping(uint32 => bytes32) internal storedBlockHashes;

    /// @dev Latest cross root hash verified block height
    uint32 public latestVerifiedBlockHeight;

    /// @dev if `verifiedChains` | CHAIN_INDEX equals to `ALL_CHAINS` defined in `Config.sol` then blocks at `blockHeight` and before it can be executed
    mapping(bytes32 => uint256) internal blockVerifiedChains;

    event ReceiveCrossRootHash(address indexed bridge, uint16 srcChainId, uint64 nonce, bytes32 blockHash, uint256 verifiedChains);

    function getPriorityRequest(uint64 idx) external view override returns(Operations.PriorityOperation memory) {
        return priorityRequests[idx];
    }

    function getAuthFact(address owner, uint32 nonce) external view override returns (bytes32) {
        return authFacts[owner][nonce];
    }

    function getCrossRootHash(uint32 blockHeight) external view override returns (bytes32 blockHash, uint256 verifiedChains) {
        blockHash = storedBlockHashes[blockHeight];
        verifiedChains = blockVerifiedChains[blockHash];
        // combine with current chain
        if (blockHash > 0) {
            verifiedChains |= CHAIN_INDEX;
        }
    }

    function receiveCrossRootHash(uint16 srcChainId, uint64 nonce, bytes32 blockHash, uint256 verifiedChains) external override {
        address bridge = msg.sender;
        require(governance.bridgeManager().isBridgeFromEnabled(bridge), "Bridge from disabled");

        blockVerifiedChains[blockHash] = blockVerifiedChains[blockHash] | verifiedChains;
        emit ReceiveCrossRootHash(bridge, srcChainId, nonce, blockHash, verifiedChains);
    }
}
