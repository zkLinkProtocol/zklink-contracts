// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./SafeCast.sol";
import "./Utils.sol";

import "./Bytes.sol";
import "./Operations.sol";
import "./ZkSyncBase.sol";

/// @title zkSync main contract part 2: commit block, prove block, execute block
/// @author Matter Labs
/// @author ZkLink Labs
contract ZkSyncBlock is ZkSyncBase {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

    bytes32 private constant EMPTY_STRING_KECCAK = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    /// @notice Data needed to process onchain operation from block public data.
    /// @notice Onchain operations is operations that need some processing on L1: Deposits, Withdrawals, ChangePubKey.
    /// @param ethWitness Some external data that can be needed for operation processing
    /// @param publicDataOffset Byte offset in public data for onchain operation
    struct OnchainOperationData {
        bytes ethWitness;
        uint32 publicDataOffset;
    }

    /// @notice Data needed to commit new block
    struct CommitBlockInfo {
        bytes32 newStateHash;
        bytes publicData;
        uint256 timestamp;
        OnchainOperationData[] onchainOperations;
        uint32 blockNumber;
        uint32 feeAccount;
        uint8 chainId; // current chain id
        uint256[] crtCommitments; // current chain roll up commitments
    }

    /// @notice Data needed to execute committed and verified block
    /// @param commitmentsInSlot verified commitments in one slot
    /// @param commitmentIdx index such that commitmentsInSlot[commitmentIdx] is current block commitment
    struct ExecuteBlockInfo {
        StoredBlockInfo storedBlock;
        bytes[] pendingOnchainOpsPubdata;
    }

    /// @notice Recursive proof input data (individual commitments are constructed onchain)
    struct ProofInput {
        uint256[] recursiveInput;
        uint256[] proof;
        uint256[] commitments;
        uint8[] vkIndexes;
        uint256[16] subproofsLimbs;
    }

    /// @notice Will run when no functions matches call data
    fallback() external payable {
        _fallback(zkSyncExit);
    }

    /// @notice Same as fallback but called when calldata is empty
    receive() external payable {
        _fallback(zkSyncExit);
    }

    /// @notice Commit block
    /// @notice 1. Checks onchain operations, timestamp.
    /// @notice 2. Store block commitments
    function commitBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData)
    external
    nonReentrant
    {
        requireActive();
        governance.requireActiveValidator(msg.sender);
        // Check that we commit blocks after last committed block
        require(storedBlockHashes[totalBlocksCommitted] == hashStoredBlockInfo(_lastCommittedBlockData), "i"); // incorrect previous block data

        for (uint32 i = 0; i < _newBlocksData.length; ++i) {
            _lastCommittedBlockData = commitOneBlock(_lastCommittedBlockData, _newBlocksData[i]);

            totalCommittedPriorityRequests += _lastCommittedBlockData.priorityOperations;
            storedBlockHashes[_lastCommittedBlockData.blockNumber] = hashStoredBlockInfo(_lastCommittedBlockData);

            emit BlockCommit(_lastCommittedBlockData.blockNumber);
        }

        totalBlocksCommitted += uint32(_newBlocksData.length);

        require(totalCommittedPriorityRequests <= totalOpenPriorityRequests, "j");
    }

    /// @notice Blocks commitment verification.
    /// @notice Only verifies block commitments without any other processing
    function proveBlocks(StoredBlockInfo[] memory _committedBlocks, ProofInput memory _proof) external nonReentrant {
        uint32 currentTotalBlocksProven = totalBlocksProven;
        for (uint256 i = 0; i < _committedBlocks.length; ++i) {
            require(hashStoredBlockInfo(_committedBlocks[i]) == storedBlockHashes[currentTotalBlocksProven + 1], "o1");
            ++currentTotalBlocksProven;

            require(_proof.commitments[i] & INPUT_MASK == uint256(_committedBlocks[i].commitment) & INPUT_MASK, "o"); // incorrect block commitment in proof
        }

        bool success =
        verifier.verifyAggregatedBlockProof(
            _proof.recursiveInput,
            _proof.proof,
            _proof.vkIndexes,
            _proof.commitments,
            _proof.subproofsLimbs
        );
        require(success, "p"); // Aggregated proof verification fail

        require(currentTotalBlocksProven <= totalBlocksCommitted, "q");
        totalBlocksProven = currentTotalBlocksProven;
    }

    /// @notice Execute blocks, completing priority operations and processing withdrawals.
    /// @notice 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// @notice 2. Finalizes block on Ethereum
    function executeBlocks(ExecuteBlockInfo[] memory _blocksData) external nonReentrant {
        requireActive();
        governance.requireActiveValidator(msg.sender);

        uint64 priorityRequestsExecuted = 0;
        uint32 nBlocks = uint32(_blocksData.length);
        for (uint32 i = 0; i < nBlocks; ++i) {
            executeOneBlock(_blocksData[i], i);
            priorityRequestsExecuted += _blocksData[i].storedBlock.priorityOperations;
            emit BlockVerification(_blocksData[i].storedBlock.blockNumber);
        }

        firstPriorityRequestId += priorityRequestsExecuted;
        totalCommittedPriorityRequests -= priorityRequestsExecuted;
        totalOpenPriorityRequests -= priorityRequestsExecuted;

        totalBlocksExecuted += nBlocks;
        require(totalBlocksExecuted <= totalBlocksProven, "n"); // Can't execute blocks more then committed and proven currently.
    }

    /// @notice Reverts unverified blocks
    function revertBlocks(StoredBlockInfo[] memory _blocksToRevert) external nonReentrant {
        governance.requireActiveValidator(msg.sender);

        uint32 blocksCommitted = totalBlocksCommitted;
        uint32 blocksToRevert = Utils.minU32(uint32(_blocksToRevert.length), blocksCommitted - totalBlocksExecuted);
        uint64 revertedPriorityRequests = 0;

        for (uint32 i = 0; i < blocksToRevert; ++i) {
            StoredBlockInfo memory storedBlockInfo = _blocksToRevert[i];
            require(storedBlockHashes[blocksCommitted] == hashStoredBlockInfo(storedBlockInfo), "r"); // incorrect stored block info

            delete storedBlockHashes[blocksCommitted];

            --blocksCommitted;
            revertedPriorityRequests += storedBlockInfo.priorityOperations;
        }

        totalBlocksCommitted = blocksCommitted;
        totalCommittedPriorityRequests -= revertedPriorityRequests;
        if (totalBlocksCommitted < totalBlocksProven) {
            totalBlocksProven = totalBlocksCommitted;
        }

        emit BlocksRevert(totalBlocksExecuted, blocksCommitted);
    }

    /// @dev Process one block commit using previous block StoredBlockInfo,
    /// @dev returns new block StoredBlockInfo
    /// @dev NOTE: Does not change storage (except events, so we can't mark it view)
    function commitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock)
    internal
    view
    returns (StoredBlockInfo memory storedNewBlock)
    {
        require(_newBlock.blockNumber == _previousBlock.blockNumber + 1, "f"); // only commit next block

        // Check timestamp of the new block
        {
            require(_newBlock.timestamp >= _previousBlock.timestamp, "g"); // Block should be after previous block
            bool timestampNotTooSmall = block.timestamp.sub(COMMIT_TIMESTAMP_NOT_OLDER) <= _newBlock.timestamp;
            bool timestampNotTooBig = _newBlock.timestamp <= block.timestamp.add(COMMIT_TIMESTAMP_APPROXIMATION_DELTA);
            require(timestampNotTooSmall && timestampNotTooBig, "h"); // New block timestamp is not valid
        }

        // Check onchain operations
        (bytes32 pendingOnchainOpsHash, uint64 priorityReqCommitted, bytes memory onchainOpsOffsetCommitment) =
        collectOnchainOps(_newBlock);

        // Create block commitment for verification proof
        bytes32 commitment = createBlockCommitment(_previousBlock, _newBlock, onchainOpsOffsetCommitment);

        return
        StoredBlockInfo(
            _newBlock.blockNumber,
            priorityReqCommitted,
            pendingOnchainOpsHash,
            _newBlock.timestamp,
            _newBlock.newStateHash,
            commitment
        );
    }

    /// @dev Increment _recipients balance to withdraw.
    function storePendingBalance(
        uint16 _tokenId,
        address _recipient,
        uint128 _amount
    ) internal {
        bytes22 packedBalanceKey = packAddressAndTokenId(_recipient, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
    }

    /// @dev Executes one block
    /// @dev 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// @dev 2. Finalizes block on Ethereum
    /// @dev _executedBlockIdx is index in the array of the blocks that we want to execute together
    function executeOneBlock(ExecuteBlockInfo memory _blockExecuteData, uint32 _executedBlockIdx) internal {
        // Ensure block was committed
        require(
            hashStoredBlockInfo(_blockExecuteData.storedBlock) ==
            storedBlockHashes[_blockExecuteData.storedBlock.blockNumber],
            "exe10" // executing block should be committed
        );
        require(_blockExecuteData.storedBlock.blockNumber == totalBlocksExecuted + _executedBlockIdx + 1, "k"); // Execute blocks in order

        bytes32 pendingOnchainOpsHash = EMPTY_STRING_KECCAK;
        for (uint32 i = 0; i < _blockExecuteData.pendingOnchainOpsPubdata.length; ++i) {
            bytes memory pubData = _blockExecuteData.pendingOnchainOpsPubdata[i];

            Operations.OpType opType = Operations.OpType(uint8(pubData[0]));
            bool concatHash = true;
            if (opType == Operations.OpType.PartialExit) {
                execPartialExit(pubData);
            } else if (opType == Operations.OpType.ForcedExit) {
                Operations.ForcedExit memory op = Operations.readForcedExitPubdata(pubData);
                storePendingBalance(op.tokenId, op.target, op.amount);
            } else if (opType == Operations.OpType.FullExit) {
                Operations.FullExit memory op = Operations.readFullExitPubdata(pubData);
                storePendingBalance(op.tokenId, op.owner, op.amount);
            } else if (opType == Operations.OpType.QuickSwap) {
                concatHash = execQuickSwap(pubData);
            } else if (opType == Operations.OpType.Mapping) {
                execMappingToken(pubData);
            } else if (opType == Operations.OpType.L1AddLQ) {
                concatHash = execL1AddLQ(pubData);
            } else if (opType == Operations.OpType.L1RemoveLQ) {
                concatHash = execL1RemoveLQ(pubData);
            } else {
                revert("l"); // unsupported op in block execution
            }
            if (concatHash) {
                pendingOnchainOpsHash = Utils.concatHash(pendingOnchainOpsHash, pubData);
            }
        }
        require(pendingOnchainOpsHash == _blockExecuteData.storedBlock.pendingOnchainOperationsHash, "m"); // incorrect onchain ops executed
    }

    /// @dev Gets operations packed in bytes array. Unpacks it and stores onchain operations.
    /// @dev Priority operations must be committed in the same order as they are in the priority queue.
    /// @dev NOTE: does not change storage! (only emits events)
    /// @dev processableOperationsHash - hash of the all operations that needs to be executed  (Deposit, Exits, ChangPubKey)
    /// @dev priorityOperationsProcessed - number of priority operations processed in this block (Deposits, FullExits)
    /// @dev offsetsCommitment - array where 1 is stored in chunk where onchainOperation begins and other are 0 (used in commitments)
    function collectOnchainOps(CommitBlockInfo memory _newBlockData)
    internal
    view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes memory offsetsCommitment
    )
    {
        bytes memory pubData = _newBlockData.publicData;

        uint64 uncommittedPriorityRequestsOffset = firstPriorityRequestId + totalCommittedPriorityRequests;
        priorityOperationsProcessed = 0;
        processableOperationsHash = EMPTY_STRING_KECCAK;

        require(pubData.length % CHUNK_BYTES == 0, "A"); // pubdata length must be a multiple of CHUNK_BYTES
        offsetsCommitment = new bytes(pubData.length / CHUNK_BYTES);
        for (uint256 i = 0; i < _newBlockData.onchainOperations.length; ++i) {
            OnchainOperationData memory onchainOpData = _newBlockData.onchainOperations[i];

            uint256 pubdataOffset = onchainOpData.publicDataOffset;
            require(pubdataOffset < pubData.length, "A1");
            require(pubdataOffset % CHUNK_BYTES == 0, "B"); // offsets should be on chunks boundaries
            uint256 chunkId = pubdataOffset / CHUNK_BYTES;
            require(offsetsCommitment[chunkId] == 0x00, "C"); // offset commitment should be empty
            offsetsCommitment[chunkId] = bytes1(0x01);

            Operations.OpType opType = Operations.OpType(uint8(pubData[pubdataOffset]));

            if (opType == Operations.OpType.Deposit) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, DEPOSIT_BYTES);

                Operations.Deposit memory depositData = Operations.readDepositPubdata(opPubData);

                Operations.checkPriorityOperation(depositData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                priorityOperationsProcessed++;
            } else if (opType == Operations.OpType.ChangePubKey) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, CHANGE_PUBKEY_BYTES);

                Operations.ChangePubKey memory op = Operations.readChangePubKeyPubdata(opPubData);

                if (onchainOpData.ethWitness.length != 0) {
                    bool valid = verifyChangePubkey(onchainOpData.ethWitness, op);
                    require(valid, "D"); // failed to verify change pubkey hash signature
                } else {
                    bool valid = authFacts[op.owner][op.nonce] == keccak256(abi.encodePacked(op.pubKeyHash));
                    require(valid, "E"); // new pub key hash is not authenticated properly
                }
            } else if (opType == Operations.OpType.QuickSwap) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, QUICK_SWAP_BYTES);
                Operations.QuickSwap memory quickSwapData = Operations.readQuickSwapPubdata(opPubData);
                require(quickSwapData.fromChainId == CHAIN_ID || quickSwapData.toChainId == CHAIN_ID, 'ZkSyncBlock: chain id');
                // fromChainId and toChainId may be the same
                if (quickSwapData.fromChainId == CHAIN_ID) {
                    Operations.checkPriorityOperation(quickSwapData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                }
                // only to chain need to handle QuickSwap in exec block
                if (quickSwapData.toChainId == CHAIN_ID) {
                    processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
                }
            } else if (opType == Operations.OpType.Mapping) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, MAPPING_BYTES);
                Operations.Mapping memory mappingData = Operations.readMappingPubdata(opPubData);
                // fromChainId and toChainId will not be the same
                require(mappingData.fromChainId != mappingData.toChainId &&
                    (mappingData.fromChainId == CHAIN_ID || mappingData.toChainId == CHAIN_ID), 'ZkSyncBlock: chain id');
                if (mappingData.fromChainId == CHAIN_ID) {
                    Operations.checkPriorityOperation(mappingData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                }
                // fromChain and toChain both will handle TokenMapping in exec
                processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
            } else if (opType == Operations.OpType.L1AddLQ) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, L1ADDLQ_BYTES);
                Operations.L1AddLQ memory l1AddLQData = Operations.readL1AddLQPubdata(opPubData);
                if (l1AddLQData.chainId == CHAIN_ID) {
                    Operations.checkPriorityOperation(l1AddLQData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                    processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
                }
            } else if (opType == Operations.OpType.L1RemoveLQ) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, L1REMOVELQ_BYTES);
                Operations.L1RemoveLQ memory l1RemoveLQData = Operations.readL1RemoveLQPubdata(opPubData);
                if (l1RemoveLQData.chainId == CHAIN_ID) {
                    Operations.checkPriorityOperation(l1RemoveLQData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                    processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
                }
            } else {
                bytes memory opPubData;

                if (opType == Operations.OpType.PartialExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, PARTIAL_EXIT_BYTES);
                } else if (opType == Operations.OpType.ForcedExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FORCED_EXIT_BYTES);
                } else if (opType == Operations.OpType.FullExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FULL_EXIT_BYTES);

                    Operations.FullExit memory fullExitData = Operations.readFullExitPubdata(opPubData);
                    Operations.checkPriorityOperation(fullExitData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                } else {
                    revert("F"); // unsupported op
                }

                processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
            }
        }
    }

    /// @notice Checks that change operation is correct
    function verifyChangePubkey(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk)
    internal
    pure
    returns (bool)
    {
        Operations.ChangePubkeyType changePkType = Operations.ChangePubkeyType(uint8(_ethWitness[0]));
        if (changePkType == Operations.ChangePubkeyType.ECRECOVER) {
            return verifyChangePubkeyECRECOVER(_ethWitness, _changePk);
        } else if (changePkType == Operations.ChangePubkeyType.CREATE2) {
            return verifyChangePubkeyCREATE2(_ethWitness, _changePk);
        } else if (changePkType == Operations.ChangePubkeyType.OldECRECOVER) {
            return verifyChangePubkeyOldECRECOVER(_ethWitness, _changePk);
        } else {
            revert("G"); // Incorrect ChangePubKey type
        }
    }

    /// @notice Checks that signature is valid for pubkey change message
    /// @param _ethWitness Signature (65 bytes) + 32 bytes of the arbitrary signed data
    /// @param _changePk Parsed change pubkey operation
    function verifyChangePubkeyECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk)
    internal
    pure
    returns (bool)
    {
        (, bytes memory signature) = Bytes.read(_ethWitness, 1, 65); // offset is 1 because we skip type of ChangePubkey
        //        (, bytes32 additionalData) = Bytes.readBytes32(_ethWitness, offset);
        bytes32 messageHash =
        keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n60",
                _changePk.pubKeyHash,
                _changePk.nonce,
                _changePk.accountId,
                bytes32(0)
            )
        );
        address recoveredAddress = Utils.recoverAddressFromEthSignature(signature, messageHash);
        return recoveredAddress == _changePk.owner && recoveredAddress != address(0);
    }

    /// @notice Checks that signature is valid for pubkey change message, old version differs by form of the signed message.
    /// @param _ethWitness Signature (65 bytes)
    /// @param _changePk Parsed change pubkey operation
    function verifyChangePubkeyOldECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk)
    internal
    pure
    returns (bool)
    {
        (, bytes memory signature) = Bytes.read(_ethWitness, 1, 65); // offset is 1 because we skip type of ChangePubkey
        bytes32 messageHash =
        keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n152",
                "Register zkLink pubkey:\n\n",
                Bytes.bytesToHexASCIIBytes(abi.encodePacked(_changePk.pubKeyHash)),
                "\n",
                "nonce: 0x",
                Bytes.bytesToHexASCIIBytes(Bytes.toBytesFromUInt32(_changePk.nonce)),
                "\n",
                "account id: 0x",
                Bytes.bytesToHexASCIIBytes(Bytes.toBytesFromUInt32(_changePk.accountId)),
                "\n\n",
                "Only sign this message for a trusted client!"
            )
        );
        address recoveredAddress = Utils.recoverAddressFromEthSignature(signature, messageHash);
        return recoveredAddress == _changePk.owner && recoveredAddress != address(0);
    }

    /// @notice Checks that signature is valid for pubkey change message
    /// @param _ethWitness Create2 deployer address, saltArg, codeHash
    /// @param _changePk Parsed change pubkey operation
    function verifyChangePubkeyCREATE2(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk)
    internal
    pure
    returns (bool)
    {
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
        address recoveredAddress =
        address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), creatorAddress, salt, codeHash)))));
        // This type of change pubkey can be done only once
        return recoveredAddress == _changePk.owner && _changePk.nonce == 0;
    }

    /// @dev Creates block commitment from its data
    /// @dev _offsetCommitment - hash of the array where 1 is stored in chunk where onchainOperation begins and 0 for other chunks
    function createBlockCommitment(
        StoredBlockInfo memory _previousBlock,
        CommitBlockInfo memory _newBlockData,
        bytes memory _offsetCommitment
    ) internal view returns (bytes32 commitment) {
        bytes32 hash = sha256(abi.encodePacked(uint256(_newBlockData.blockNumber), uint256(_newBlockData.feeAccount)));
        hash = sha256(abi.encodePacked(hash, _previousBlock.stateHash));
        hash = sha256(abi.encodePacked(hash, _newBlockData.newStateHash));
        hash = sha256(abi.encodePacked(hash, uint256(_newBlockData.timestamp)));

        bytes memory pubdata = abi.encodePacked(_newBlockData.publicData, _offsetCommitment);

        /// The code below is equivalent to `commitment = sha256(abi.encodePacked(hash, _publicData))`

        /// We use inline assembly instead of this concise and readable code in order to avoid copying of `_publicData` (which saves ~90 gas per transfer operation).

        /// Specifically, we perform the following trick:
        /// First, replace the first 32 bytes of `_publicData` (where normally its length is stored) with the value of `hash`.
        /// Then, we call `sha256` precompile passing the `_publicData` pointer and the length of the concatenated byte buffer.
        /// Finally, we put the `_publicData.length` back to its original location (to the first word of `_publicData`).
        assembly {
            let hashResult := mload(0x40)
            let pubDataLen := mload(pubdata)
            mstore(pubdata, hash)
        // staticcall to the sha256 precompile at address 0x2
            let success := staticcall(gas(), 0x2, pubdata, add(pubDataLen, 0x20), hashResult, 0x20)
            mstore(pubdata, pubDataLen)

        // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }

            hash := mload(hashResult)
        }

        // current chain rolling hash
        bytes32 rollingHash = hash & bytes32(INPUT_MASK);
        commitment = calInput(rollingHash, _newBlockData.chainId, _newBlockData.crtCommitments);
    }

    /// @notice Calculate input used in commitment of each chain
    function calInput(bytes32 rollingHash, uint8 chainId, uint256[] memory crtCommitments) internal pure returns (bytes32) {
        bytes memory concatenated = abi.encodePacked(rollingHash, uint256(chainId));
        for (uint i = 0; i < crtCommitments.length; i++) {
            concatenated = abi.encodePacked(concatenated, crtCommitments[i]);
        }
        return sha256(concatenated)  & bytes32(INPUT_MASK);
    }

    function execQuickSwap(bytes memory pubData) internal returns (bool) {
        Operations.QuickSwap memory op = Operations.readQuickSwapPubdata(pubData);
        if (op.amountOut == 0) {
            // only from chain need to process pubData when swap fail
            if (op.fromChainId != CHAIN_ID) {
                return false;
            }
            // store amountIn of from token to owner
            storePendingBalance(op.fromTokenId, op.owner, op.amountIn);
        } else {
            // only to chain need to process pubData when swap success
            if (op.toChainId != CHAIN_ID) {
                return false;
            }
            bytes32 hash = keccak256(abi.encodePacked(op.to, op.toTokenId, op.amountOut, op.acceptTokenId, op.acceptAmountOutMin, op.nonce));
            withdrawToAccepter(op.to, op.toTokenId, op.amountOut, hash);
        }
        return true;
    }

    function execPartialExit(bytes memory pubData) internal {
        Operations.PartialExit memory op = Operations.readPartialExitPubdata(pubData);
        if (op.isFastWithdraw) {
            withdrawToAccepter(op.owner, op.tokenId, op.amount, op.fastWithdrawFee, op.nonce);
        } else {
            storePendingBalance(op.tokenId, op.owner, op.amount);
        }
    }

    function withdrawToAccepter(address to, uint16 tokenId, uint128 amount, uint16 withdrawFee, uint32 nonce) internal {
        bytes32 hash = keccak256(abi.encodePacked(to, tokenId, amount, withdrawFee, nonce));
        withdrawToAccepter(to, tokenId, amount, hash);
    }

    function withdrawToAccepter(address to, uint16 tokenId, uint128 amount, bytes32 hash) internal {
        address accepter = accepts[hash];
        if (accepter == address(0)) {
            // receiver act as a accepter
            accepts[hash] = to;
            storePendingBalance(tokenId, to, amount);
        } else {
            storePendingBalance(tokenId, accepter, amount);
        }
    }

    function execMappingToken(bytes memory pubData) internal {
        Operations.Mapping memory op = Operations.readMappingPubdata(pubData);
        address tokenAddress = governance.tokenAddresses(op.tokenId);
        uint128 burnAmount = op.amount.sub(op.fee);
        if (op.fromChainId == CHAIN_ID) {
            // burn token from ZkSync
            vault.withdraw(op.tokenId, address(this), burnAmount);
            IMappingToken(tokenAddress).burn(burnAmount);
        } else {
            // mint burn amount of token to user or accepter
            bytes32 hash = keccak256(abi.encodePacked(op.to, op.tokenId, burnAmount, op.withdrawFee, op.nonce));
            address accepter = accepts[hash];
            if (accepter == address(0)) {
                accepts[hash] = op.to;
                IMappingToken(tokenAddress).mint(op.to, burnAmount);
            } else {
                IMappingToken(tokenAddress).mint(accepter, burnAmount);
            }
        }
    }

    function execL1AddLQ(bytes memory pubData) internal returns (bool) {
        Operations.L1AddLQ memory op = Operations.readL1AddLQPubdata(pubData);
        if (op.chainId != CHAIN_ID) {
            return false;
        }
        // lpAmount is zero means add liquidity fail
        if (op.lpAmount > 0) {
            governance.nft().confirmAddLq(op.nftTokenId, op.lpAmount);
        } else {
            governance.nft().revokeAddLq(op.nftTokenId);
        }
        return true;
    }

    function execL1RemoveLQ(bytes memory pubData) internal returns (bool) {
        Operations.L1RemoveLQ memory op = Operations.readL1RemoveLQPubdata(pubData);
        if (op.chainId != CHAIN_ID) {
            return false;
        }
        // token amount is zero means remove liquidity fail
        if (op.amount > 0) {
            governance.nft().confirmRemoveLq(op.nftTokenId);
            // add token amount to owner's pending balance
            storePendingBalance(op.tokenId, op.owner, op.amount);
        } else {
            governance.nft().revokeRemoveLq(op.nftTokenId);
        }
        return true;
    }
}
