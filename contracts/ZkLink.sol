// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/ReentrancyGuard.sol";
import "./Storage.sol";
import "./zksync/Events.sol";
import "./zksync/UpgradeableMaster.sol";
import "./zksync/SafeMath.sol";
import "./zksync/SafeMathUInt128.sol";
import "./zksync/SafeCast.sol";
import "./zksync/Utils.sol";
import "./zksync/IERC20.sol";

/// @title ZkLink contract
/// @dev Be carefully to use delegate to split contract(when the code size is too big) code to different files
/// see https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#delegatecall-selfdestruct
/// @dev add `nonReentrant` to all user external interfaces to avoid a closed loop reentrant attack
/// @author zk.link
contract ZkLink is ReentrancyGuard, Storage, Events, UpgradeableMaster {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

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
    /// @param commitmentsInSlot verified commitments in one slot
    /// @param commitmentIdx index such that commitmentsInSlot[commitmentIdx] is current block commitment
    struct ExecuteBlockInfo {
        StoredBlockInfo storedBlock;
        bytes[] pendingOnchainOpsPubdata; // only contain ops of the current chain
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

        (address _verifierAddress, address _peripheryAddress, address _networkGovernor,
        uint32 _blockNumber, uint256 _timestamp, bytes32 _stateHash, bytes32 _commitment, bytes32 _syncHash) =
            abi.decode(initializationParameters, (address, address, address, uint32, uint256, bytes32, bytes32, bytes32));
        require(_verifierAddress != address(0), "i0");
        require(_peripheryAddress != address(0), "i1");
        require(_networkGovernor != address(0), "i2");

        verifier = Verifier(_verifierAddress);
        periphery = _peripheryAddress;
        networkGovernor = _networkGovernor;

        // We need initial state hash because it is used in the commitment of the next block
        StoredBlockInfo memory storedBlockZero =
            StoredBlockInfo(_blockNumber, 0, EMPTY_STRING_KECCAK, _timestamp, _stateHash, _commitment, _syncHash);

        storedBlockHashes[_blockNumber] = hashStoredBlockInfo(storedBlockZero);
        totalBlocksCommitted = totalBlocksProven = totalBlocksSynchronized = totalBlocksExecuted = _blockNumber;
    }

    /// @notice ZkLink contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    function upgrade(bytes calldata upgradeParameters) external onlyDelegateCall {
        (address _peripheryAddress) = abi.decode(upgradeParameters, (address));
        require(_peripheryAddress != address(0), "u0");
        periphery = _peripheryAddress;
    }

    // =================Delegate call=================

    /// @notice Will run when no functions matches call data
    fallback() external payable {
        _fallback(periphery);
    }

    /// @notice Same as fallback but called when calldata is empty
    receive() external payable {
        _fallback(periphery);
    }

    // =================User interface=================

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    function depositETH(address _zkLinkAddress, uint8 _subAccountId) external payable nonReentrant {
        deposit(ETH_ADDRESS, SafeCast.toUint128(msg.value), _zkLinkAddress, _subAccountId, false);
    }

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    /// @dev it MUST be ok to call other external functions within from this function
    /// when the token(eg. erc777,erc1155) is not a pure erc20 token
    /// @param _token Token address
    /// @param _amount Token amount
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    /// @param _mapping If true and token has a mapping token, user will receive mapping token at l2
    function depositERC20(IERC20 _token, uint104 _amount, address _zkLinkAddress, uint8 _subAccountId, bool _mapping) external nonReentrant {
        // erc20 token address MUST NOT be ETH_ADDRESS which represent deposit eth
        // it's nearly impossible to create an erc20 token which address is the ETH_ADDRESS
        // add check to avoid this extreme case
        require(address(_token) != ETH_ADDRESS, "e");
        // support non-standard tokens
        uint256 balanceBefore = _token.balanceOf(address(this));
        // NOTE, the balance of this contract will be increased
        // if the token is not a pure erc20 token, it could do anything within the transferFrom
        // we MUST NOT use `token.balanceOf(address(this))` in any control structures
        _token.transferFrom(msg.sender, address(this), _amount);
        uint256 balanceAfter = _token.balanceOf(address(this));
        uint128 depositAmount = SafeCast.toUint128(balanceAfter.sub(balanceBefore));

        deposit(address(_token), depositAmount, _zkLinkAddress, _subAccountId, _mapping);
    }

    /// @notice Register full exit request - pack pubdata, add priority request
    /// @param _accountId Numerical id of the account
    /// @param _subAccountId The exit sub account
    /// @param _tokenId Token id
    /// @param _mapping If true and token has a mapping token, user's mapping token balance will be decreased at l2
    function requestFullExit(uint32 _accountId, uint8 _subAccountId, uint16 _tokenId, bool _mapping) external active nonReentrant {
        // ===Checks===
        // accountId and subAccountId MUST be valid
        require(_accountId <= MAX_ACCOUNT_ID, "a0");
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "a1");
        // token MUST be registered to ZkLink
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "a2");
        uint16 srcTokenId = _tokenId;
        if (_mapping) {
            require(rt.mappingTokenId > 0, "a3");
            srcTokenId = rt.mappingTokenId;
        }
        // to prevent ddos
        require(totalOpenPriorityRequests < MAX_PRIORITY_REQUESTS, "a4");

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

    /// @notice  Withdraws tokens from zkLink contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _tokenId Token id
    /// @param _amount Amount to withdraw to request.
    /// @dev NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token zkLink contract
    /// balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    function withdrawPendingBalance(address payable _owner, uint16 _tokenId, uint128 _amount) external nonReentrant {
        // ===Checks===
        // token MUST be registered to ZkLink
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "b0");

        // Set the available amount to withdraw
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        uint128 balance = pendingBalances[packedBalanceKey];
        uint128 amount = Utils.minU128(balance, _amount);
        require(amount > 0, "b1");

        // ===Effects====
        pendingBalances[packedBalanceKey] = balance - amount; // amount <= balance

        // ===Interactions===
        address tokenAddress = rt.tokenAddress;
        if (tokenAddress == ETH_ADDRESS) {
            // solhint-disable-next-line  avoid-low-level-calls
            (bool success, ) = _owner.call{value: amount}("");
            require(success, "b2");
        } else {
            // We will allow withdrawals of `value` such that:
            // `value` <= user pending balance
            // `value` can be bigger then `amount` requested if token takes fee from sender in addition to `amount` requested
            uint128 amount1 = this.transferERC20(IERC20(tokenAddress), _owner, amount, balance, rt.standard);
            if (amount1 != amount) {
                pendingBalances[packedBalanceKey] = balance - amount1; // amount1 <= balance
                amount = amount1;
            }
        }
        emit Withdrawal(_tokenId, amount);
    }

    /// @notice Sends tokens
    /// @dev NOTE: will revert if transfer call fails or rollup balance difference (before and after transfer) is bigger than _maxAmount
    /// This function is used to allow tokens to spend zkLink contract balance up to amount that is requested
    /// @param _token Token address
    /// @param _to Address of recipient
    /// @param _amount Amount of tokens to transfer
    /// @param _maxAmount Maximum possible amount of tokens to transfer to this account
    /// @param _isStandard If token is a standard erc20
    /// @return withdrawnAmount The really amount than will be debited from user
    function transferERC20(IERC20 _token, address _to, uint128 _amount, uint128 _maxAmount, bool _isStandard) external returns (uint128 withdrawnAmount) {
        require(msg.sender == address(this), "n0"); // can be called only from this contract as one "external" call (to revert all this function state changes if it is needed)

        // most tokens are standard, fewer query token balance can save gas
        if (_isStandard) {
            _token.transfer(_to, _amount);
            return _amount;
        } else {
            uint256 balanceBefore = _token.balanceOf(address(this));
            _token.transfer(_to, _amount);
            uint256 balanceAfter = _token.balanceOf(address(this));
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            require(balanceDiff > 0, "n1"); // transfer is considered successful only if the balance of the contract decreased after transfer
            require(balanceDiff <= _maxAmount, "n2"); // rollup balance difference (before and after transfer) is bigger than `_maxAmount`

            // It is safe to convert `balanceDiff` to `uint128` without additional checks, because `balanceDiff <= _maxAmount`
            return uint128(balanceDiff);
        }
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

    /// @notice Recursive proof input data (individual commitments are constructed onchain)
    struct ProofInput {
        uint256[] recursiveInput;
        uint256[] proof;
        uint256[] commitments;
        uint8[] vkIndexes;
        uint256[16] subproofsLimbs;
    }

    /// @notice Blocks commitment verification.
    /// @dev Only verifies block commitments without any other processing
    function proveBlocks(StoredBlockInfo[] memory _committedBlocks, ProofInput memory _proof) external nonReentrant {
        // ===Checks===
        uint32 currentTotalBlocksProven = totalBlocksProven;
        for (uint256 i = 0; i < _committedBlocks.length; ++i) {
            require(hashStoredBlockInfo(_committedBlocks[i]) == storedBlockHashes[currentTotalBlocksProven + 1], "x0");
            ++currentTotalBlocksProven;

            require(_proof.commitments[i] & INPUT_MASK == uint256(_committedBlocks[i].commitment) & INPUT_MASK, "x1");
        }

        // ===Effects===
        require(currentTotalBlocksProven <= totalBlocksCommitted, "x2");
        totalBlocksProven = currentTotalBlocksProven;

        // ===Interactions===
        bool success = verifier.verifyAggregatedBlockProof(
            _proof.recursiveInput,
            _proof.proof,
            _proof.vkIndexes,
            _proof.commitments,
            _proof.subproofsLimbs
        );
        require(success, "x3");
    }

    /// @notice Reverts unExecuted blocks
    function revertBlocks(StoredBlockInfo[] memory _blocksToRevert) external onlyValidator nonReentrant {
        uint32 blocksCommitted = totalBlocksCommitted;
        uint32 blocksToRevert = Utils.minU32(uint32(_blocksToRevert.length), blocksCommitted - totalBlocksExecuted);
        uint64 revertedPriorityRequests = 0;

        for (uint32 i = 0; i < blocksToRevert; ++i) {
            StoredBlockInfo memory storedBlockInfo = _blocksToRevert[i];
            require(storedBlockHashes[blocksCommitted] == hashStoredBlockInfo(storedBlockInfo), "c"); // incorrect stored block info

            delete storedBlockHashes[blocksCommitted];

            --blocksCommitted;
            // overflow is impossible
            revertedPriorityRequests += storedBlockInfo.priorityOperations;
        }

        totalBlocksCommitted = blocksCommitted;
        totalCommittedPriorityRequests -= revertedPriorityRequests;
        if (totalBlocksCommitted < totalBlocksProven) {
            totalBlocksProven = totalBlocksCommitted;
        }
        if (totalBlocksProven < totalBlocksSynchronized) {
            totalBlocksSynchronized = totalBlocksProven;
        }

        emit BlocksRevert(totalBlocksExecuted, blocksCommitted);
    }

    /// @notice Execute blocks, completing priority operations and processing withdrawals.
    /// @dev 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// 2. Finalizes block on Ethereum
    function executeBlocks(ExecuteBlockInfo[] memory _blocksData) external active onlyValidator nonReentrant {
        uint64 priorityRequestsExecuted = 0;
        uint32 nBlocks = uint32(_blocksData.length);
        require(nBlocks > 0, "d0");

        for (uint32 i = 0; i < nBlocks; ++i) {
            executeOneBlock(_blocksData[i], i);
            // overflow is impossible
            priorityRequestsExecuted += _blocksData[i].storedBlock.priorityOperations;
        }

        // overflow is impossible
        firstPriorityRequestId += priorityRequestsExecuted;
        totalCommittedPriorityRequests -= priorityRequestsExecuted;
        totalOpenPriorityRequests -= priorityRequestsExecuted;

        // overflow is impossible
        totalBlocksExecuted += nBlocks;
        require(totalBlocksExecuted <= totalBlocksSynchronized, "d1");

        emit BlockExecuted(_blocksData[nBlocks-1].storedBlock.blockNumber);
    }

    // =================Internal functions=================

    function deposit(address _tokenAddress, uint128 _amount, address _zkLinkAddress, uint8 _subAccountId, bool _mapping) internal active {
        // ===Checks===
        // disable deposit to zero address
        require(_zkLinkAddress != address(0), "e1");
        // subAccountId MUST be valid
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "e2");
        // token MUST be registered to ZkLink and deposit MUST be enabled
        uint16 tokenId = tokenIds[_tokenAddress];
        uint16 targetTokenId = tokenId;
        RegisteredToken memory rt = tokens[tokenId];
        require(rt.registered, "e3");
        require(!rt.paused, "e4");

        // improve decimals before send to layer two
        _amount = improveDecimals(_amount, rt.decimals);
        // disable deposit with zero amount
        require(_amount > 0 && _amount <= MAX_DEPOSIT_AMOUNT, "e0");

        if (_mapping) {
            require(rt.mappingTokenId > 0, "e5");
            targetTokenId = rt.mappingTokenId;
        }
        // to prevent ddos
        require(totalOpenPriorityRequests < MAX_PRIORITY_REQUESTS, "e6");

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
        // Expiration block is: current block number + priority expiration delta, overflow is impossible
        uint64 expirationBlock = uint64(block.number + PRIORITY_EXPIRATION);

        // overflow is impossible
        uint64 nextPriorityRequestId = firstPriorityRequestId + totalOpenPriorityRequests;

        bytes20 hashedPubData = Utils.hashBytesToBytes20(_pubData);

        priorityRequests[nextPriorityRequestId] = Operations.PriorityOperation({
            hashedPubData: hashedPubData,
            expirationBlock: expirationBlock,
            opType: _opType
        });

        emit NewPriorityRequest(msg.sender, nextPriorityRequestId, _opType, _pubData, uint256(expirationBlock));

        totalOpenPriorityRequests++;
    }

    function _commitBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData, bool compressed, CompressedBlockExtraInfo[] memory _newBlocksExtraData) internal active onlyValidator nonReentrant {
        // ===Checks===
        require(_newBlocksData.length > 0, "f0");
        // Check that we commit blocks after last committed block
        require(storedBlockHashes[totalBlocksCommitted] == hashStoredBlockInfo(_lastCommittedBlockData), "f1");

        // ===Effects===
        for (uint32 i = 0; i < _newBlocksData.length; ++i) {
            _lastCommittedBlockData = commitOneBlock(_lastCommittedBlockData, _newBlocksData[i], compressed, _newBlocksExtraData[i]);

            // overflow is impossible
            totalCommittedPriorityRequests += _lastCommittedBlockData.priorityOperations;
            storedBlockHashes[_lastCommittedBlockData.blockNumber] = hashStoredBlockInfo(_lastCommittedBlockData);
        }
        require(totalCommittedPriorityRequests <= totalOpenPriorityRequests, "f2");

        // overflow is impossible
        totalBlocksCommitted += uint32(_newBlocksData.length);

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
            // MUST be in a range of [block.timestamp - COMMIT_TIMESTAMP_NOT_OLDER, block.timestamp + COMMIT_TIMESTAMP_APPROXIMATION_DELTA]
            require(block.timestamp.sub(COMMIT_TIMESTAMP_NOT_OLDER) <= _newBlock.timestamp &&
                _newBlock.timestamp <= block.timestamp.add(COMMIT_TIMESTAMP_APPROXIMATION_DELTA), "g3");
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
            for(uint i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
                if (i != CHAIN_ID) {
                    onchainOperationPubdataHashs[i] = _newBlockExtra.onchainOperationPubdataHashs[i];
                }
            }
        }
        bytes32 syncHash = createSyncHash(commitment, onchainOperationPubdataHashs);

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

        // overflow is impossible
        uint64 uncommittedPriorityRequestsOffset = firstPriorityRequestId + totalCommittedPriorityRequests;
        priorityOperationsProcessed = 0;
        onchainOperationPubdataHashs = initOnchainOperationPubdataHashs();

        processableOperationsHash = EMPTY_STRING_KECCAK;

        for (uint256 i = 0; i < _newBlockData.onchainOperations.length; ++i) {
            OnchainOperationData memory onchainOpData = _newBlockData.onchainOperations[i];

            uint256 pubdataOffset = onchainOpData.publicDataOffset;
            // chainIdOffset = pubdataOffset + 1
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
            priorityOperationsProcessed += newPriorityProceeded;
            // group onchain operations pubdata hash by chain id
            onchainOperationPubdataHashs[chainId] = Utils.concatHash(onchainOperationPubdataHashs[chainId], opPubData);
            if (processablePubData.length > 0) {
                // concat processable onchain operations pubdata hash of current chain
                processableOperationsHash = Utils.concatHash(processableOperationsHash, processablePubData);
            }
        }
    }

    function initOnchainOperationPubdataHashs() internal pure returns (bytes32[] memory onchainOperationPubdataHashs) {
        onchainOperationPubdataHashs = new bytes32[](MAX_CHAIN_ID + 1); // overflow is impossible
        for(uint i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
            uint256 chainIndex = 1 << i - 1; // overflow is impossible
            if (chainIndex & ALL_CHAINS == chainIndex) {
                onchainOperationPubdataHashs[i] = EMPTY_STRING_KECCAK;
            }
        }
    }

    function checkChainId(uint8 chainId) internal pure {
        require(chainId >= MIN_CHAIN_ID && chainId <= MAX_CHAIN_ID, "i1");
        // revert if invalid chain id exist
        // for example, when `ALL_CHAINS` = 13(1 << 0 | 1 << 2 | 1 << 3), it means 2(1 << 2 - 1) is a invalid chainId
        uint256 chainIndex = 1 << chainId - 1; // overflow is impossible
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
                processablePubData = Bytes.slice(opPubData, 0, opPubData.length);
            }
        }
    }

    /// @dev Create synchronization hash for cross chain block verify
    function createSyncHash(bytes32 commitment, bytes32[] memory onchainOperationPubdataHashs) internal pure returns (bytes32 syncHash) {
        syncHash = commitment;
        for (uint8 i = MIN_CHAIN_ID; i <= MAX_CHAIN_ID; ++i) {
            uint256 chainIndex = 1 << i - 1; // overflow is impossible
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
    function verifyChangePubkey(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal view returns (bool) {
        ChangePubkeyType changePkType = ChangePubkeyType(uint8(_ethWitness[0]));
        if (changePkType == ChangePubkeyType.ECRECOVER) {
            return verifyChangePubkeyECRECOVER(_ethWitness, _changePk);
        } else if (changePkType == ChangePubkeyType.CREATE2) {
            return verifyChangePubkeyCREATE2(_ethWitness, _changePk);
        } else {
            revert("l");
        }
    }

    /// @notice Checks that signature is valid for pubkey change message
    function verifyChangePubkeyECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal view returns (bool) {
        (, bytes memory signature) = Bytes.read(_ethWitness, 1, 65); // offset is 1 because we skip type of ChangePubkey
        uint cid;
        assembly {
            cid := chainid()
        }
        bytes32 domainSeparator = keccak256(abi.encode(CHANGE_PUBKEY_DOMAIN_SEPARATOR, CHANGE_PUBKEY_HASHED_NAME, CHANGE_PUBKEY_HASHED_VERSION, cid, address(this)));
        bytes32 structHash = keccak256(abi.encode(CHANGE_PUBKEY_TYPE_HASH, _changePk.pubKeyHash, _changePk.nonce, _changePk.accountId));
        bytes32 messageHash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
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
        // This type of change pubkey can be done only once
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
                executeWithdraw(op);
            } else if (opType == Operations.OpType.ForcedExit) {
                Operations.ForcedExit memory op = Operations.readForcedExitPubdata(pubData);
                executeForcedExit(op);
            } else if (opType == Operations.OpType.FullExit) {
                Operations.FullExit memory op = Operations.readFullExitPubdata(pubData);
                executeFullExit(op);
            } else {
                revert("m2");
            }
            pendingOnchainOpsHash = Utils.concatHash(pendingOnchainOpsHash, pubData);
        }
        require(pendingOnchainOpsHash == _blockExecuteData.storedBlock.pendingOnchainOperationsHash, "m3");
    }

    /// @dev Execute withdraw operation
    function executeWithdraw(Operations.Withdraw memory op) internal {
        // token MUST be registered
        RegisteredToken memory rt = tokens[op.tokenId];
        require(rt.registered, "o0");
        // recover withdraw amount
        uint128 amount = recoveryDecimals(op.amount, rt.decimals);

        // nonce > 0 means fast withdraw
        if (op.nonce > 0) {
            bytes32 fwHash = keccak256(abi.encodePacked(op.owner, op.tokenId, amount, op.fastWithdrawFeeRate, op.nonce));
            address accepter = accepts[op.accountId][fwHash];
            if (accepter == address(0)) {
                // receiver act as a accepter
                accepts[op.accountId][fwHash] = op.owner;
                withdrawOrStore(op.tokenId, rt.tokenAddress, rt.standard, op.owner, amount);
            } else {
                // just increase the pending balance of accepter
                increasePendingBalance(op.tokenId, accepter, amount);
            }
        } else {
            withdrawOrStore(op.tokenId, rt.tokenAddress, rt.standard, op.owner, amount);
        }
    }

    /// @dev Execute force exit operation
    function executeForcedExit(Operations.ForcedExit memory op) internal {
        // token MUST be registered
        RegisteredToken memory rt = tokens[op.tokenId];
        require(rt.registered, "p0");
        // recover withdraw amount
        uint128 amount = recoveryDecimals(op.amount, rt.decimals);

        withdrawOrStore(op.tokenId, rt.tokenAddress, rt.standard, op.target, amount);
    }

    /// @dev Execute full exit operation
    function executeFullExit(Operations.FullExit memory op) internal {
        // token MUST be registered
        RegisteredToken memory rt = tokens[op.tokenId];
        require(rt.registered, "r0");
        // recover withdraw amount
        uint128 amount = recoveryDecimals(op.amount, rt.decimals);

        withdrawOrStore(op.tokenId, rt.tokenAddress, rt.standard, op.owner, amount);
    }

    /// @dev 1. Try to send token to _recipients
    /// 2. On failure: Increment _recipients balance to withdraw.
    function withdrawOrStore(uint16 _tokenId, address _tokenAddress, bool _isTokenStandard, address _recipient, uint128 _amount) internal {
        if (_amount == 0) {
            return;
        }
        bool sent = false;
        if (_tokenAddress == ETH_ADDRESS) {
            address payable toPayable = address(uint160(_recipient));
            sent = sendETHNoRevert(toPayable, _amount);
        } else {
            // We use `transferERC20` here to check that `ERC20` token indeed transferred `_amount`
            // and fail if token subtracted from zkLink balance more then `_amount` that was requested.
            // This can happen if token subtracts fee from sender while transferring `_amount` that was requested to transfer.
            try this.transferERC20{gas: WITHDRAWAL_GAS_LIMIT}(IERC20(_tokenAddress), _recipient, _amount, _amount, _isTokenStandard) {
                sent = true;
            } catch {
                sent = false;
            }
        }
        if (sent) {
            emit Withdrawal(_tokenId, _amount);
        } else {
            increasePendingBalance(_tokenId, _recipient, _amount);
        }
    }

    /// @dev Increase `_recipient` balance to withdraw
    function increasePendingBalance(uint16 _tokenId, address _recipient, uint128 _amount) internal {
        bytes22 packedBalanceKey = packAddressAndTokenId(_recipient, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        emit WithdrawalPending(_tokenId, _recipient, _amount);
    }

    /// @notice Sends ETH
    /// @param _to Address of recipient
    /// @param _amount Amount of tokens to transfer
    /// @return bool flag indicating that transfer is successful
    function sendETHNoRevert(address payable _to, uint256 _amount) internal returns (bool) {
        // solhint-disable-next-line  avoid-low-level-calls
        bool callSuccess;
        assembly {
            callSuccess := call(WITHDRAWAL_GAS_LIMIT, _to, _amount, 0, 0, 0, 0)
        }
        return callSuccess;
    }

    /// @dev improve decimals when deposit, for example, user deposit 2 USDC in ui, and the decimals of USDC is 6
    /// the `_amount` params when call contract will be 2 * 10^6
    /// because all token decimals defined in layer two is 18
    /// so the `_amount` in deposit pubdata should be 2 * 10^6 * 10^(18 - 6) = 2 * 10^18
    function improveDecimals(uint128 _amount, uint8 _decimals) internal pure returns (uint128) {
        // overflow is impossible,  `_decimals` has been checked when register token
        return _amount.mul(SafeCast.toUint128(10**(TOKEN_DECIMALS_OF_LAYER2 - _decimals)));
    }

    /// @dev recover decimals when withdraw, this is the opposite of improve decimals
    function recoveryDecimals(uint128 _amount, uint8 _decimals) internal pure returns (uint128) {
        // overflow is impossible,  `_decimals` has been checked when register token
        return _amount.div(SafeCast.toUint128(10**(TOKEN_DECIMALS_OF_LAYER2 - _decimals)));
    }
}
