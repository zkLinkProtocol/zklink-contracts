// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./zksync/ReentrancyGuard.sol";
import "./Storage.sol";
import "./zksync/Events.sol";
import "./zksync/UpgradeableMaster.sol";
import "./zksync/Utils.sol";

/// @title ZkLink contract
/// @dev Be carefully to use delegate to split contract(when the code size is too big) code to different files
/// see https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#delegatecall-selfdestruct
/// @dev add `nonReentrant` to all user external interfaces to avoid a closed loop reentrant attack
/// @author zk.link
contract ZkLink is ReentrancyGuard, Storage, Events, UpgradeableMaster {
    using SafeERC20 for IERC20;

    enum ChangePubkeyType {ECRECOVER, CREATE2}

    /// @notice Data needed to process onchain operation from block public data.
    /// @notice Onchain operations is operations that need some processing on L1: Deposits, Withdrawals, ChangePubKey.
    /// @param ethWitness Some external data that can be needed for operation processing
    /// @param publicDataOffset Byte offset in public data for onchain operation
    struct OnchainOperationData {
        bytes ethWitness;
        uint32 publicDataOffset;
    }

    /// @notice Data needed to commit new block
    /// @dev `publicData` contain pubdata of all chains when compressed is disabled or only current chain if compressed is enable
    /// `onchainOperations` contain onchain ops of all chains when compressed is disabled or only current chain if compressed is enable
    struct CommitBlockInfo {
        bytes32 newStateHash;
        bytes publicData;
        uint256 timestamp;
        OnchainOperationData[] onchainOperations;
        uint32 blockNumber;
        uint32 feeAccount;
    }

    struct CompressedBlockExtraInfo {
        bytes32 publicDataHash; // pubdata hash of all chains
        bytes32 offsetCommitmentHash; // all chains pubdata offset commitment hash
        bytes32[] onchainOperationPubdataHashs; // onchain operation pubdata hash of the all other chains
    }

    /// @notice Data needed to execute committed and verified block
    /// @param storedBlock the block info that will be executed
    /// @param pendingOnchainOpsPubdata onchain ops(e.g. Withdraw, ForcedExit, FullExit) that will be executed
    struct ExecuteBlockInfo {
        StoredBlockInfo storedBlock;
        bytes[] pendingOnchainOpsPubdata;
    }

    // =================Upgrade interface=================

    /// @notice Notice period before activation preparation status of upgrade mode
    function getNoticePeriod() external pure override returns (uint256) {
        return UPGRADE_NOTICE_PERIOD;
    }

    /// @notice Checks that contract is ready for upgrade
    /// @return bool flag indicating that contract is ready for upgrade
    function isReadyForUpgrade() external view override returns (bool) {
        return !exodusMode;
    }

    /// @notice ZkLink contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    /// @dev _verifierAddress The address of Verifier contract
    /// @dev _peripheryAddress The address of ZkLinkPeriphery contract
    /// @dev _networkGovernor The address of system controller
    function initialize(bytes calldata initializationParameters) external onlyDelegateCall {
        initializeReentrancyGuard();

        (address _verifierAddress, address _networkGovernor,
        uint32 _blockNumber, uint256 _timestamp, bytes32 _stateHash, bytes32 _commitment, bytes32 _syncHash) =
            abi.decode(initializationParameters, (address, address, uint32, uint256, bytes32, bytes32, bytes32));
        require(_verifierAddress != address(0), "i0");
        require(_networkGovernor != address(0), "i2");

        verifier = IVerifier(_verifierAddress);
        networkGovernor = _networkGovernor;

        // We need initial state hash because it is used in the commitment of the next block
        StoredBlockInfo memory storedBlockZero =
            StoredBlockInfo(_blockNumber, 0, EMPTY_STRING_KECCAK, _timestamp, _stateHash, _commitment, _syncHash);

        storedBlockHashes[_blockNumber] = hashStoredBlockInfo(storedBlockZero);
        totalBlocksCommitted = totalBlocksProven = totalBlocksSynchronized = totalBlocksExecuted = _blockNumber;
    }

    // =================Delegate call=================

    /// @notice Will run when no functions matches call data
    fallback() external payable {
        address periphery = $(defined(PERIPHERY_ADDRESS) ? PERIPHERY_ADDRESS : 0x0000000000000000000000000000000000000000);
        _fallback(periphery);
    }

    // =================User interface=================

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable nonReentrant {
        // ETH is not a mapping token in zkLink
        deposit(ETH_ADDRESS, SafeCast.toUint128(msg.value), _zkLinkAddress, _subAccountId, false);
    }

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    /// @dev it MUST be ok to call other external functions within from this function
    /// when the token(eg. erc777) is not a pure erc20 token
    /// @param _token Token address
    /// @param _amount Token amount
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    /// @param _mapping If true and token has a mapping token, user will receive mapping token at L2
    function depositERC20(IERC20 _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external nonReentrant {
        // erc20 token address MUST NOT be ETH_ADDRESS which represent deposit eth
        // it's nearly impossible to create an erc20 token which address is the ETH_ADDRESS
        // add check to avoid this extreme case
        require(address(_token) != ETH_ADDRESS, "e");
        deposit(address(_token), _amount, _zkLinkAddress, _subAccountId, _mapping);
    }

    /// @notice Register full exit request - pack pubdata, add priority request
    /// @param _accountId Numerical id of the account
    /// @param _subAccountId The exit sub account
    /// @param _tokenId Token id
    /// @param _mapping If true and token has a mapping token, user's mapping token balance will be decreased at L2
    function requestFullExit(uint32 _accountId, uint8 _subAccountId, uint16 _tokenId, bool _mapping) external active nonReentrant {
        // ===Checks===
        // accountId and subAccountId MUST be valid
        require(_accountId <= MAX_ACCOUNT_ID && _accountId != GLOBAL_ASSET_ACCOUNT_ID, "a0");
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "a1");
        // token MUST be registered to ZkLink
        RegisteredToken storage rt = tokens[_tokenId];
        require(rt.registered, "a2");
        // when full exit stable tokens (e.g. USDC, BUSD) with mapping, USD will be deducted from account
        // and stable token will be transfer from zkLink contract to account address
        // all other tokens don't support mapping
        uint16 srcTokenId;
        if (_mapping) {
            require(_tokenId >= MIN_USD_STABLE_TOKEN_ID && _tokenId <= MAX_USD_STABLE_TOKEN_ID, "a3");
            srcTokenId = USD_TOKEN_ID;
        } else {
            srcTokenId = _tokenId;
        }

        // ===Effects===
        // Priority Queue request
        Operations.FullExit memory op =
            Operations.FullExit({
                chainId: CHAIN_ID,
                accountId: _accountId,
                subAccountId: _subAccountId,
                owner: msg.sender, // Only the owner of account can fullExit for them self
                tokenId: _tokenId,
                srcTokenId: srcTokenId,
                amount: 0 // unknown at this point
            });
        bytes memory pubData = Operations.writeFullExitPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.FullExit, pubData);
    }

    // =================Validator interface=================

    /// @notice Commit block
    /// @dev 1. Checks onchain operations of all chains, timestamp.
    /// 2. Store block commitments, sync hash
    function commitBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData) external
    {
        CompressedBlockExtraInfo[] memory _newBlocksExtraData = new CompressedBlockExtraInfo[](_newBlocksData.length);
        _commitBlocks(_lastCommittedBlockData, _newBlocksData, false, _newBlocksExtraData);
    }

    /// @notice Commit compressed block
    /// @dev 1. Checks onchain operations of current chain, timestamp.
    /// 2. Store block commitments, sync hash
    function commitCompressedBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData, CompressedBlockExtraInfo[] memory _newBlocksExtraData) external {
        _commitBlocks(_lastCommittedBlockData, _newBlocksData, true, _newBlocksExtraData);
    }

    /// @notice Execute blocks, completing priority operations and processing withdrawals.
    /// @dev 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// 2. Finalizes block on Ethereum
    function executeBlocks(ExecuteBlockInfo[] memory _blocksData) external active onlyValidator nonReentrant {
        uint32 nBlocks = uint32(_blocksData.length);
        require(nBlocks > 0, "d0");

        require(totalBlocksExecuted + nBlocks <= totalBlocksSynchronized, "d1");

        uint64 priorityRequestsExecuted = 0;
        for (uint32 i = 0; i < nBlocks; ++i) {
            executeOneBlock(_blocksData[i], i);
            priorityRequestsExecuted = priorityRequestsExecuted + _blocksData[i].storedBlock.priorityOperations;
        }

        firstPriorityRequestId = firstPriorityRequestId + priorityRequestsExecuted;
        totalCommittedPriorityRequests = totalCommittedPriorityRequests - priorityRequestsExecuted;
        totalOpenPriorityRequests = totalOpenPriorityRequests - priorityRequestsExecuted;

        totalBlocksExecuted = totalBlocksExecuted + nBlocks;

        emit BlockExecuted(_blocksData[nBlocks-1].storedBlock.blockNumber);
    }

    // =================Internal functions=================

    function deposit(address _tokenAddress, uint128 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) internal active {
        // ===Checks===
        // disable deposit to zero address or global asset account
        require(_zkLinkAddress != bytes32(0) && _zkLinkAddress != GLOBAL_ASSET_ACCOUNT_ADDRESS, "e1");
        // subAccountId MUST be valid
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "e2");
        // token MUST be registered to ZkLink and deposit MUST be enabled
        uint16 tokenId = tokenIds[_tokenAddress];
        // 0 is a invalid token and MUST NOT register to zkLink contract
        require(tokenId != 0, "e3");
        RegisteredToken storage rt = tokens[tokenId];
        require(rt.registered, "e3");
        require(!rt.paused, "e4");

        if (_tokenAddress != ETH_ADDRESS) {
            // transfer erc20 token from sender to zkLink contract
            uint256 balanceBefore = IERC20(_tokenAddress).balanceOf(address(this));
            IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
            uint256 balanceAfter = IERC20(_tokenAddress).balanceOf(address(this));
            // only support pure erc20
            require(_amount == balanceAfter - balanceBefore, "e6");
        }

        // improve decimals before send to layer two
        _amount = improveDecimals(_amount, rt.decimals);
        // disable deposit with zero amount
        require(_amount > 0 && _amount <= MAX_DEPOSIT_AMOUNT, "e0");

        // only stable tokens(e.g. USDC, BUSD) support mapping to USD when deposit
        uint16 targetTokenId;
        if (_mapping) {
            require(tokenId >= MIN_USD_STABLE_TOKEN_ID && tokenId <= MAX_USD_STABLE_TOKEN_ID, "e5");
            targetTokenId = USD_TOKEN_ID;
        } else {
            targetTokenId = tokenId;
        }

        // ===Effects===
        // Priority Queue request
        Operations.Deposit memory op =
        Operations.Deposit({
            chainId: CHAIN_ID,
            accountId: 0, // unknown at this point
            subAccountId: _subAccountId,
            owner: _zkLinkAddress,
            tokenId: tokenId,
            targetTokenId: targetTokenId,
            amount: _amount
        });
        bytes memory pubData = Operations.writeDepositPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.Deposit, pubData);
    }

    // Priority queue

    /// @notice Saves priority request in storage
    /// @dev Calculates expiration block for request, store this request and emit NewPriorityRequest event
    /// @param _opType Rollup operation type
    /// @param _pubData Operation pubdata
    function addPriorityRequest(Operations.OpType _opType, bytes memory _pubData) internal {
        // Expiration block is: current block number + priority expiration delta
        uint64 expirationBlock = SafeCast.toUint64(block.number + PRIORITY_EXPIRATION);

        uint64 nextPriorityRequestId = firstPriorityRequestId + totalOpenPriorityRequests;

        bytes20 hashedPubData = Utils.hashBytesToBytes20(_pubData);

        priorityRequests[nextPriorityRequestId] = Operations.PriorityOperation({
            hashedPubData: hashedPubData,
            expirationBlock: expirationBlock,
            opType: _opType
        });

        emit NewPriorityRequest(msg.sender, nextPriorityRequestId, _opType, _pubData, uint256(expirationBlock));

        totalOpenPriorityRequests = totalOpenPriorityRequests + 1;
    }

    function _commitBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData, bool compressed, CompressedBlockExtraInfo[] memory _newBlocksExtraData) internal active onlyValidator nonReentrant {
        // ===Checks===
        require(_newBlocksData.length > 0, "f0");
        // Check that we commit blocks after last committed block
        require(storedBlockHashes[totalBlocksCommitted] == hashStoredBlockInfo(_lastCommittedBlockData), "f1");

        // ===Effects===
        for (uint32 i = 0; i < _newBlocksData.length; ++i) {
            _lastCommittedBlockData = commitOneBlock(_lastCommittedBlockData, _newBlocksData[i], compressed, _newBlocksExtraData[i]);

            // forward `totalCommittedPriorityRequests` because it's will be reused in the next `commitOneBlock`
            totalCommittedPriorityRequests = totalCommittedPriorityRequests + _lastCommittedBlockData.priorityOperations;
            storedBlockHashes[_lastCommittedBlockData.blockNumber] = hashStoredBlockInfo(_lastCommittedBlockData);
        }
        require(totalCommittedPriorityRequests <= totalOpenPriorityRequests, "f2");

        totalBlocksCommitted = totalBlocksCommitted + SafeCast.toUint32(_newBlocksData.length);
        // If enable compressed commit then we can ignore prove and ensure that block is correct by sync
        if (compressed && ENABLE_COMMIT_COMPRESSED_BLOCK) {
            totalBlocksProven = totalBlocksCommitted;
        }

        // log the last new committed block number
        emit BlockCommit(_lastCommittedBlockData.blockNumber);
    }

    /// @dev Process one block commit using previous block StoredBlockInfo,
    /// returns new block StoredBlockInfo
    /// NOTE: Does not change storage (except events, so we can't mark it view)
    function commitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock, bool _compressed, CompressedBlockExtraInfo memory _newBlockExtra) internal view returns (StoredBlockInfo memory storedNewBlock) {
        require(_newBlock.blockNumber == _previousBlock.blockNumber + 1, "g0");
        require(!_compressed || ENABLE_COMMIT_COMPRESSED_BLOCK, "g1");

        // Check timestamp of the new block
        {
            require(_newBlock.timestamp >= _previousBlock.timestamp, "g2");
        }

        // Check onchain operations
        (
            bytes32 pendingOnchainOpsHash,
            uint64 priorityReqCommitted,
            bytes memory onchainOpsOffsetCommitment,
            bytes32[] memory onchainOperationPubdataHashs
        ) =
        collectOnchainOps(_newBlock);

        // Create block commitment for verification proof
        bytes32 commitment = createBlockCommitment(_previousBlock, _newBlock, _compressed, _newBlockExtra, onchainOpsOffsetCommitment);

        // Create synchronization hash for cross chain block verify
        if (_compressed) {
            require(_newBlockExtra.onchainOperationPubdataHashs.length == MAX_CHAIN_ID + 1, "g3");
            for(uint i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
                if (i != CHAIN_ID) {
                    onchainOperationPubdataHashs[i] = _newBlockExtra.onchainOperationPubdataHashs[i];
                }
            }
        }
        bytes32 syncHash = createSyncHash(_previousBlock.syncHash, commitment, onchainOperationPubdataHashs);

        return StoredBlockInfo(
            _newBlock.blockNumber,
            priorityReqCommitted,
            pendingOnchainOpsHash,
            _newBlock.timestamp,
            _newBlock.newStateHash,
            commitment,
            syncHash
        );
    }

    /// @dev Gets operations packed in bytes array. Unpacks it and stores onchain operations.
    /// Priority operations must be committed in the same order as they are in the priority queue.
    /// NOTE: does not change storage! (only emits events)
    /// processableOperationsHash - hash of the all operations of the current chain that needs to be executed  (Withdraws, ForcedExits, FullExits)
    /// priorityOperationsProcessed - number of priority operations processed of the current chain in this block (Deposits, FullExits)
    /// offsetsCommitment - array where 1 is stored in chunk where onchainOperation begins and other are 0 (used in commitments)
    /// onchainOperationPubdatas - onchain operation (Deposits, ChangePubKeys, Withdraws, ForcedExits, FullExits) pubdatas group by chain id (used in cross chain block verify)
    function collectOnchainOps(CommitBlockInfo memory _newBlockData) internal view returns (bytes32 processableOperationsHash, uint64 priorityOperationsProcessed, bytes memory offsetsCommitment, bytes32[] memory onchainOperationPubdataHashs) {
        bytes memory pubData = _newBlockData.publicData;
        // pubdata length must be a multiple of CHUNK_BYTES
        require(pubData.length % CHUNK_BYTES == 0, "h0");
        offsetsCommitment = new bytes(pubData.length / CHUNK_BYTES);

        uint64 uncommittedPriorityRequestsOffset = firstPriorityRequestId + totalCommittedPriorityRequests;
        priorityOperationsProcessed = 0;
        onchainOperationPubdataHashs = initOnchainOperationPubdataHashs();

        processableOperationsHash = EMPTY_STRING_KECCAK;

        for (uint256 i = 0; i < _newBlockData.onchainOperations.length; ++i) {
            OnchainOperationData memory onchainOpData = _newBlockData.onchainOperations[i];

            uint256 pubdataOffset = onchainOpData.publicDataOffset;
            // uint256 chainIdOffset = pubdataOffset.add(1);
            // comment this value to resolve stack too deep error
            require(pubdataOffset + 1 < pubData.length, "h1");
            require(pubdataOffset % CHUNK_BYTES == 0, "h2");

            {
                uint256 chunkId = pubdataOffset / CHUNK_BYTES;
                require(offsetsCommitment[chunkId] == 0x00, "h3"); // offset commitment should be empty
                offsetsCommitment[chunkId] = bytes1(0x01);
            }

            // check chain id
            uint8 chainId = uint8(pubData[pubdataOffset + 1]);
            checkChainId(chainId);

            Operations.OpType opType = Operations.OpType(uint8(pubData[pubdataOffset]));

            uint64 nextPriorityOpIndex = uncommittedPriorityRequestsOffset + priorityOperationsProcessed;
            (uint64 newPriorityProceeded, bytes memory opPubData, bytes memory processablePubData) = checkOnchainOp(
                opType,
                chainId,
                pubData,
                pubdataOffset,
                nextPriorityOpIndex,
                onchainOpData.ethWitness);
            priorityOperationsProcessed = priorityOperationsProcessed + newPriorityProceeded;
            // group onchain operations pubdata hash by chain id
            onchainOperationPubdataHashs[chainId] = Utils.concatHash(onchainOperationPubdataHashs[chainId], opPubData);
            if (processablePubData.length > 0) {
                // concat processable onchain operations pubdata hash of current chain
                processableOperationsHash = Utils.concatHash(processableOperationsHash, processablePubData);
            }
        }
    }

    function initOnchainOperationPubdataHashs() internal pure returns (bytes32[] memory onchainOperationPubdataHashs) {
        // overflow is impossible, max(MAX_CHAIN_ID + 1) = 256
        // use index of onchainOperationPubdataHashs as chain id
        // index start from [0, MIN_CHAIN_ID - 1] left unused
        onchainOperationPubdataHashs = new bytes32[](MAX_CHAIN_ID + 1);
        for(uint i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
            uint256 chainIndex = 1 << i - 1; // overflow is impossible, min(i) = MIN_CHAIN_ID = 1
            if (chainIndex & ALL_CHAINS == chainIndex) {
                onchainOperationPubdataHashs[i] = EMPTY_STRING_KECCAK;
            }
        }
    }

    function checkChainId(uint8 chainId) internal pure {
        require(chainId >= MIN_CHAIN_ID && chainId <= MAX_CHAIN_ID, "i1");
        // revert if invalid chain id exist
        // for example, when `ALL_CHAINS` = 13(1 << 0 | 1 << 2 | 1 << 3), it means 2(1 << 2 - 1) is a invalid chainId
        uint256 chainIndex = 1 << chainId - 1; // overflow is impossible, min(i) = MIN_CHAIN_ID = 1
        require(chainIndex & ALL_CHAINS == chainIndex, "i2");
    }

    function checkOnchainOp(Operations.OpType opType, uint8 chainId, bytes memory pubData, uint256 pubdataOffset, uint64 nextPriorityOpIdx, bytes memory ethWitness) internal view returns (uint64 priorityOperationsProcessed, bytes memory opPubData, bytes memory processablePubData) {
        priorityOperationsProcessed = 0;
        processablePubData = new bytes(0);
        // ignore check if ops are not part of the current chain
        if (opType == Operations.OpType.Deposit) {
            opPubData = Bytes.slice(pubData, pubdataOffset, DEPOSIT_BYTES);
            if (chainId == CHAIN_ID) {
                Operations.Deposit memory op = Operations.readDepositPubdata(opPubData);
                Operations.checkPriorityOperation(op, priorityRequests[nextPriorityOpIdx]);
                priorityOperationsProcessed = 1;
            }
        } else if (opType == Operations.OpType.ChangePubKey) {
            opPubData = Bytes.slice(pubData, pubdataOffset, CHANGE_PUBKEY_BYTES);
            if (chainId == CHAIN_ID) {
                Operations.ChangePubKey memory op = Operations.readChangePubKeyPubdata(opPubData);
                if (ethWitness.length != 0) {
                    bool valid = verifyChangePubkey(ethWitness, op);
                    require(valid, "k0");
                } else {
                    bool valid = authFacts[op.owner][op.nonce] == keccak256(abi.encodePacked(op.pubKeyHash));
                    require(valid, "k1");
                }
            }
        } else {
            if (opType == Operations.OpType.Withdraw) {
                opPubData = Bytes.slice(pubData, pubdataOffset, WITHDRAW_BYTES);
            } else if (opType == Operations.OpType.ForcedExit) {
                opPubData = Bytes.slice(pubData, pubdataOffset, FORCED_EXIT_BYTES);
            } else if (opType == Operations.OpType.FullExit) {
                opPubData = Bytes.slice(pubData, pubdataOffset, FULL_EXIT_BYTES);
                if (chainId == CHAIN_ID) {
                    Operations.FullExit memory fullExitData = Operations.readFullExitPubdata(opPubData);
                    Operations.checkPriorityOperation(fullExitData, priorityRequests[nextPriorityOpIdx]);
                    priorityOperationsProcessed = 1;
                }
            } else {
                revert("k2");
            }
            if (chainId == CHAIN_ID) {
                // clone opPubData here instead of return its reference
                // because opPubData and processablePubData will be consumed in later concatHash
                processablePubData = Bytes.slice(opPubData, 0, opPubData.length);
            }
        }
    }

    /// @dev Create synchronization hash for cross chain block verify
    function createSyncHash(bytes32 preBlockSyncHash, bytes32 commitment, bytes32[] memory onchainOperationPubdataHashs) internal pure returns (bytes32 syncHash) {
        syncHash = Utils.concatTwoHash(preBlockSyncHash, commitment);
        for (uint8 i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
            uint256 chainIndex = 1 << i - 1; // overflow is impossible, min(i) = MIN_CHAIN_ID = 1
            if (chainIndex & ALL_CHAINS == chainIndex) {
                syncHash = Utils.concatTwoHash(syncHash, onchainOperationPubdataHashs[i]);
            }
        }
    }

    /// @dev Creates block commitment from its data
    /// @dev _offsetCommitment - hash of the array where 1 is stored in chunk where onchainOperation begins and 0 for other chunks
    function createBlockCommitment(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlockData, bool _compressed, CompressedBlockExtraInfo memory _newBlockExtraData, bytes memory offsetsCommitment) internal pure returns (bytes32 commitment) {
        bytes32 offsetsCommitmentHash = !_compressed ? sha256(offsetsCommitment) : _newBlockExtraData.offsetCommitmentHash;
        bytes32 newBlockPubDataHash = !_compressed ? sha256(_newBlockData.publicData) : _newBlockExtraData.publicDataHash;
        commitment = sha256(abi.encodePacked(
                uint256(_newBlockData.blockNumber),
                uint256(_newBlockData.feeAccount),
                _previousBlock.stateHash,
                _newBlockData.newStateHash,
                uint256(_newBlockData.timestamp),
                newBlockPubDataHash,
                offsetsCommitmentHash
            ));
    }

    /// @notice Checks that change operation is correct
    function verifyChangePubkey(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool) {
        ChangePubkeyType changePkType = ChangePubkeyType(uint8(_ethWitness[0]));
        if (changePkType == ChangePubkeyType.ECRECOVER) {
            return verifyChangePubkeyECRECOVER(_ethWitness, _changePk);
        } else if (changePkType == ChangePubkeyType.CREATE2) {
            return verifyChangePubkeyCREATE2(_ethWitness, _changePk);
        } else {
            return false;
        }
    }

    /// @notice Checks that signature is valid for pubkey change message
    function verifyChangePubkeyECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool) {
        (, bytes memory signature) = Bytes.read(_ethWitness, 1, 65); // offset is 1 because we skip type of ChangePubkey
        bytes memory message = abi.encodePacked("ChangePubKey\nPubKeyHash: ", Strings.toHexString(uint160(_changePk.pubKeyHash)), "\nNonce: ", Strings.toString(_changePk.nonce), "\nAccountId: ", Strings.toString(_changePk.accountId));
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", Strings.toString(message.length), message));
        address recoveredAddress = Utils.recoverAddressFromEthSignature(signature, messageHash);
        return recoveredAddress == _changePk.owner;
    }

    /// @notice Checks that signature is valid for pubkey change message
    function verifyChangePubkeyCREATE2(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool) {
        address creatorAddress;
        bytes32 saltArg; // salt arg is additional bytes that are encoded in the CREATE2 salt
        bytes32 codeHash;
        uint256 offset = 1; // offset is 1 because we skip type of ChangePubkey
        (offset, creatorAddress) = Bytes.readAddress(_ethWitness, offset);
        (offset, saltArg) = Bytes.readBytes32(_ethWitness, offset);
        (offset, codeHash) = Bytes.readBytes32(_ethWitness, offset);
        // salt from CREATE2 specification
        bytes32 salt = keccak256(abi.encodePacked(saltArg, _changePk.pubKeyHash));
        // Address computation according to CREATE2 definition: https://eips.ethereum.org/EIPS/eip-1014
        address recoveredAddress = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), creatorAddress, salt, codeHash))))
        );
        // This type of change pubkey can be done only once(when the account is not active)
        return recoveredAddress == _changePk.owner && _changePk.nonce == 0;
    }

    /// @dev Executes one block
    /// 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// 2. Finalizes block on Ethereum
    /// _executedBlockIdx is index in the array of the blocks that we want to execute together
    function executeOneBlock(ExecuteBlockInfo memory _blockExecuteData, uint32 _executedBlockIdx) internal {
        // Ensure block was committed
        require(
            hashStoredBlockInfo(_blockExecuteData.storedBlock) ==
            storedBlockHashes[_blockExecuteData.storedBlock.blockNumber],
            "m0"
        );
        require(_blockExecuteData.storedBlock.blockNumber == totalBlocksExecuted + _executedBlockIdx + 1, "m1");

        bytes32 pendingOnchainOpsHash = EMPTY_STRING_KECCAK;
        for (uint32 i = 0; i < _blockExecuteData.pendingOnchainOpsPubdata.length; ++i) {
            bytes memory pubData = _blockExecuteData.pendingOnchainOpsPubdata[i];

            Operations.OpType opType = Operations.OpType(uint8(pubData[0]));

            // `pendingOnchainOpsPubdata` only contains ops of the current chain
            // no need to check chain id

            if (opType == Operations.OpType.Withdraw) {
                Operations.Withdraw memory op = Operations.readWithdrawPubdata(pubData);
                // account request fast withdraw and sub account supply nonce
                _executeWithdraw(op.accountId, op.accountId, op.subAccountId, op.nonce, op.owner, op.tokenId, op.amount, op.fastWithdrawFeeRate, op.fastWithdraw);
            } else if (opType == Operations.OpType.ForcedExit) {
                Operations.ForcedExit memory op = Operations.readForcedExitPubdata(pubData);
                // request forced exit for target account but initiator sub account supply nonce
                // forced exit require fast withdraw default and take no fee for fast withdraw
                _executeWithdraw(op.targetAccountId, op.initiatorAccountId, op.initiatorSubAccountId, op.initiatorNonce, op.target, op.tokenId, op.amount, 0, 1);
            } else if (opType == Operations.OpType.FullExit) {
                Operations.FullExit memory op = Operations.readFullExitPubdata(pubData);
                increasePendingBalance(op.tokenId, op.owner, op.amount);
            } else {
                revert("m2");
            }
            pendingOnchainOpsHash = Utils.concatHash(pendingOnchainOpsHash, pubData);
        }
        require(pendingOnchainOpsHash == _blockExecuteData.storedBlock.pendingOnchainOperationsHash, "m3");
    }

    /// @dev Execute fast withdraw or normal withdraw according by fastWithdraw flag
    function _executeWithdraw(uint32 accountId, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce, address owner, uint16 tokenId, uint128 amount, uint16 fastWithdrawFeeRate, uint8 fastWithdraw) internal {
        // token MUST be registered
        RegisteredToken storage rt = tokens[tokenId];
        require(rt.registered, "o0");

        if (fastWithdraw == 1) {
            // recover withdraw amount
            uint128 acceptAmount = recoveryDecimals(amount, rt.decimals);
            uint128 dustAmount = amount - improveDecimals(acceptAmount, rt.decimals);
            bytes32 fwHash = getFastWithdrawHash(accountIdOfNonce, subAccountIdOfNonce, nonce, owner, tokenId, acceptAmount, fastWithdrawFeeRate);
            address acceptor = accepts[accountId][fwHash];
            if (acceptor == address(0)) {
                // receiver act as a acceptor
                accepts[accountId][fwHash] = owner;
                increasePendingBalance(tokenId, owner, amount);
            } else {
                increasePendingBalance(tokenId, acceptor, amount - dustAmount);
                // add dust to owner
                if (dustAmount > 0) {
                    increasePendingBalance(tokenId, owner, dustAmount);
                }
            }
        } else {
            increasePendingBalance(tokenId, owner, amount);
        }
    }

    /// @dev Increase `_recipient` balance to withdraw
    /// @param _amount amount that need to recovery decimals when withdraw
    function increasePendingBalance(uint16 _tokenId, address _recipient, uint128 _amount) internal {
        bytes32 recipient = extendAddress(_recipient);
        increaseBalanceToWithdraw(recipient, _tokenId, _amount);
        emit WithdrawalPending(_tokenId, recipient, _amount);
    }
}
