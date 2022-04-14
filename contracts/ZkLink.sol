// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/SafeMath.sol";
import "./zksync/SafeMathUInt128.sol";
import "./zksync/SafeCast.sol";
import "./zksync/Utils.sol";
import "./zksync/Operations.sol";
import "./zksync/UpgradeableMaster.sol";
import "./zksync/ReentrancyGuard.sol";
import "./zksync/Config.sol";
import "./zksync/Events.sol";
import "./Storage.sol";

/// @title ZkLink contract
/// @dev Be carefully to use delegate to split contract(when the code size is too big) code to different files
/// https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#delegatecall-selfdestruct
/// @author zk.link
contract ZkLink is ReentrancyGuard, Storage, Config, Events, UpgradeableMaster {
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

    constructor() {
    }

    // Upgrade functional

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
    /// @dev _governanceAddress The address of Governance contract
    /// @dev _verifierAddress The address of Verifier contract
    /// @dev _peripheryAddress The address of ZkLinkPeriphery contract
    /// @dev _genesisStateHash Genesis blocks (first block) state tree root hash
    function initialize(bytes calldata initializationParameters) external {
        initializeReentrancyGuard();

        (address _governanceAddress, address _verifierAddress, address _peripheryAddress, bytes32 _genesisStateHash) =
            abi.decode(initializationParameters, (address, address, address, bytes32));

        verifier = Verifier(_verifierAddress);
        governance = Governance(_governanceAddress);
        periphery = ZkLinkPeriphery(_peripheryAddress);

        // We need initial state hash because it is used in the commitment of the next block
        StoredBlockInfo memory storedBlockZero =
            StoredBlockInfo(0, 0, EMPTY_STRING_KECCAK, 0, _genesisStateHash, bytes32(0));

        storedBlockHashes[0] = hashStoredBlockInfo(storedBlockZero);
    }

    /// @notice ZkLink contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    function upgrade(bytes calldata upgradeParameters) external nonReentrant {}

    // =================User interface=================

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    function depositETH(address _zkLinkAddress, uint8 _subAccountId) external payable nonReentrant {
        deposit(ETH_ADDRESS, SafeCast.toUint128(msg.value), _zkLinkAddress, _subAccountId);
    }

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    /// @dev it MUST be ok to call other external functions within from this function
    /// when the token(eg. erc777,erc1155) is not a pure erc20 token
    /// @param _token Token address
    /// @param _amount Token amount
    /// @param _zkLinkAddress The receiver Layer 2 address
    /// @param _subAccountId The receiver sub account
    function depositERC20(IERC20 _token, uint104 _amount, address _zkLinkAddress, uint8 _subAccountId) external nonReentrant {
        // support non-standard tokens
        uint256 balanceBefore = _token.balanceOf(address(this));
        // NOTE, if the token is not a pure erc20 token, it could do anything within the transferFrom
        _token.transferFrom(msg.sender, address(this), _amount);
        uint256 balanceAfter = _token.balanceOf(address(this));
        uint128 depositAmount = SafeCast.toUint128(balanceAfter.sub(balanceBefore));

        deposit(address(_token), depositAmount, _zkLinkAddress, _subAccountId);
    }

    /// @notice Register full exit request - pack pubdata, add priority request
    /// @param _accountId Numerical id of the account
    /// @param _subAccountId The exit sub account
    /// @param _tokenId Token id
    function requestFullExit(uint32 _accountId, uint8 _subAccountId, uint16 _tokenId) external active nonReentrant {
        // ===Checks===
        // to prevent ddos
        require(totalOpenPriorityRequests < MAX_PRIORITY_REQUESTS, "ZkLink: too many request");
        // accountId and subAccountId MUST be valid
        require(_accountId <= MAX_ACCOUNT_ID, "ZkLink: invalid accountId");
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "ZkLink: invalid subAccountId");
        // token MUST be registered to ZkLink
        Governance.RegisteredToken memory rt = governance.getToken(_tokenId);
        require(rt.registered, "ZkLink: token not registered");

        // ===Effects===
        // Priority Queue request
        Operations.FullExit memory op =
            Operations.FullExit({
                chainId: CHAIN_ID,
                accountId: _accountId,
                subAccountId: _subAccountId,
                owner: msg.sender, // Only the owner of account can fullExit for them self
                tokenId: _tokenId,
                amount: 0 // unknown at this point
            });
        bytes memory pubData = Operations.writeFullExitPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.FullExit, pubData);
    }

    /// @notice Checks if Exodus mode must be entered. If true - enters exodus mode and emits ExodusMode event.
    /// @dev Exodus mode must be entered in case of current ethereum block number is higher than the oldest
    /// of existed priority requests expiration block number.
    function activateExodusMode() external active {
        bool trigger = block.number >= priorityRequests[firstPriorityRequestId].expirationBlock &&
            priorityRequests[firstPriorityRequestId].expirationBlock != 0;

        if (trigger) {
            exodusMode = true;
            emit ExodusMode();
        }
    }

    /// @notice Withdraws token from ZkLink to root chain in case of exodus mode. User must provide proof that he owns funds
    /// @param _storedBlockInfo Last verified block
    /// @param _owner Owner of the account
    /// @param _accountId Id of the account in the tree
    /// @param _subAccountId Id of the subAccount in the tree
    /// @param _proof Proof
    /// @param _tokenId The token want to withdraw
    /// @param _amount Amount for owner (must be total amount, not part of it)
    function performExodus(
        StoredBlockInfo calldata _storedBlockInfo,
        address _owner,
        uint32 _accountId,
        uint8 _subAccountId,
        uint16 _tokenId,
        uint128 _amount,
        uint256[] calldata _proof
    ) external notActive {
        // ===Checks===
        // accountId and subAccountId MUST be valid
        require(_accountId <= MAX_ACCOUNT_ID, "ZkLink: invalid accountId");
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "ZkLink: invalid subAccountId");
        // token MUST be registered to ZkLink
        Governance.RegisteredToken memory rt = governance.getToken(_tokenId);
        require(rt.registered, "ZkLink: token not registered");
        // performed exodus MUST not be already exited
        require(!performedExodus[_accountId][_subAccountId][_tokenId], "ZkLink: performed exodus");
        // incorrect stored block info
        require(storedBlockHashes[totalBlocksExecuted] == hashStoredBlockInfo(_storedBlockInfo), "ZkLink: incorrect stored block info");
        // exit proof MUST be correct
        bool proofCorrect = verifier.verifyExitProof(_storedBlockInfo.stateHash, _accountId, _subAccountId, _owner, _tokenId, _amount, _proof);
        require(proofCorrect, "ZkLink: incorrect proof");

        // ===Effects===
        performedExodus[_accountId][_subAccountId][_tokenId] = true;
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        emit WithdrawalPending(_tokenId, _owner, _amount);
    }

    /// @notice Accrues users balances from deposit priority requests in Exodus mode
    /// @dev WARNING: Only for Exodus mode
    /// Canceling may take several separate transactions to be completed
    /// @param _n number of requests to process
    /// @param _depositsPubdata deposit details
    function cancelOutstandingDepositsForExodusMode(uint64 _n, bytes[] calldata _depositsPubdata) external notActive {
        // ===Checks===
        uint64 toProcess = Utils.minU64(totalOpenPriorityRequests, _n);
        require(toProcess > 0, "ZkLink: no deposits to process");
        require(toProcess == _depositsPubdata.length, "ZkLink: invalid deposits pubdata");

        // ===Effects===
        uint64 currentDepositIdx = 0;
        for (uint64 id = firstPriorityRequestId; id < firstPriorityRequestId + toProcess; ++id) {
            if (priorityRequests[id].opType == Operations.OpType.Deposit) {
                bytes memory depositPubdata = _depositsPubdata[currentDepositIdx];
                require(Utils.hashBytesToBytes20(depositPubdata) == priorityRequests[id].hashedPubData, "ZkLink: invalid deposit hash");
                ++currentDepositIdx;

                Operations.Deposit memory op = Operations.readDepositPubdata(depositPubdata);
                bytes22 packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                increaseBalanceToWithdraw(packedBalanceKey, op.amount);
            }
            delete priorityRequests[id];
        }
        firstPriorityRequestId += toProcess;
        totalOpenPriorityRequests -= toProcess;
    }

    /// @notice  Withdraws tokens from zkLink contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _tokenId Token id
    /// @param _amount Amount to withdraw to request.
    ///         NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token zkLink contract
    ///         balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    function withdrawPendingBalance(address payable _owner, uint16 _tokenId, uint128 _amount) external nonReentrant {
        // ===Checks===
        // token MUST be registered to ZkLink
        Governance.RegisteredToken memory rt = governance.getToken(_tokenId);
        require(rt.registered, "ZkLink: token not registered");

        // Set the available amount to withdraw
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        uint128 balance = pendingBalances[packedBalanceKey];
        uint128 amount = Utils.minU128(balance, _amount);
        require(amount > 0, "ZkLink: nothing to withdraw");

        // ===Effects====
        pendingBalances[packedBalanceKey] = balance - amount; // amount <= balance

        // ===Interactions===
        address tokenAddress = rt.tokenAddress;
        if (tokenAddress == ETH_ADDRESS) {
            (bool success, ) = _owner.call{value: amount}("");
            require(success, "ZkLink: eth withdraw failed");
        } else {
            // We will allow withdrawals of `value` such that:
            // `value` <= user pending balance
            // `value` can be bigger then `amount` requested if token takes fee from sender in addition to `amount` requested
            uint128 amount1 = this.transferERC20(IERC20(tokenAddress), _owner, amount, balance);
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
    /// @return withdrawnAmount The really amount than will be debited from user
    function transferERC20(
        IERC20 _token,
        address _to,
        uint128 _amount,
        uint128 _maxAmount
    ) external returns (uint128 withdrawnAmount) {
        require(msg.sender == address(this), "ZkLink: not ZkLink"); // can be called only from this contract as one "external" call (to revert all this function state changes if it is needed)

        uint256 balanceBefore = _token.balanceOf(address(this));
        _token.transfer(_to, _amount);
        uint256 balanceAfter = _token.balanceOf(address(this));
        uint256 balanceDiff = balanceBefore.sub(balanceAfter);
        require(balanceDiff > 0, "ZkLink: transfer failed"); // transfer is considered successful only if the balance of the contract decreased after transfer
        require(balanceDiff <= _maxAmount, "ZkLink: transfer too much"); // rollup balance difference (before and after transfer) is bigger than `_maxAmount`

        // It is safe to convert `balanceDiff` to `uint128` without additional checks, because `balanceDiff <= _maxAmount`
        return uint128(balanceDiff);
    }

    /// @notice Set data for changing pubkey hash using onchain authorization.
    ///         Transaction author (msg.sender) should be L2 account address
    /// New pubkey hash can be reset, to do that user should send two transactions:
    ///         1) First `setAuthPubkeyHash` transaction for already used `_nonce` will set timer.
    ///         2) After `AUTH_FACT_RESET_TIMELOCK` time is passed second `setAuthPubkeyHash` transaction will reset pubkey hash for `_nonce`.
    /// @param _pubkeyHash New pubkey hash
    /// @param _nonce Nonce of the change pubkey L2 transaction
    function setAuthPubkeyHash(bytes calldata _pubkeyHash, uint32 _nonce) external active {
        require(_pubkeyHash.length == PUBKEY_HASH_BYTES, "ZkLink: invalid pubkeyHash"); // PubKeyHash should be 20 bytes.
        if (authFacts[msg.sender][_nonce] == bytes32(0)) {
            authFacts[msg.sender][_nonce] = keccak256(_pubkeyHash);
        } else {
            uint256 currentResetTimer = authFactsResetTimer[msg.sender][_nonce];
            if (currentResetTimer == 0) {
                authFactsResetTimer[msg.sender][_nonce] = block.timestamp;
            } else {
                require(block.timestamp.sub(currentResetTimer) >= AUTH_FACT_RESET_TIMELOCK, "ZkLink: too early to reset auth");
                authFactsResetTimer[msg.sender][_nonce] = 0;
                authFacts[msg.sender][_nonce] = keccak256(_pubkeyHash);
            }
        }
    }

    // =================Validator interface=================

    /// @notice Commit block
    /// @dev 1. Checks onchain operations, timestamp.
    /// 2. Store block commitments
    function commitBlocks(StoredBlockInfo memory _lastCommittedBlockData, CommitBlockInfo[] memory _newBlocksData) external active onlyValidator nonReentrant
    {
        // ===Checks===
        require(_newBlocksData.length > 0, "ZkLink: no commit");
        // Check that we commit blocks after last committed block
        require(storedBlockHashes[totalBlocksCommitted] == hashStoredBlockInfo(_lastCommittedBlockData), "ZkLink: incorrect previous block data");

        // ===Effects===
        for (uint32 i = 0; i < _newBlocksData.length; ++i) {
            _lastCommittedBlockData = commitOneBlock(_lastCommittedBlockData, _newBlocksData[i]);

            // overflow is impossible
            totalCommittedPriorityRequests += _lastCommittedBlockData.priorityOperations;
            storedBlockHashes[_lastCommittedBlockData.blockNumber] = hashStoredBlockInfo(_lastCommittedBlockData);
        }
        require(totalCommittedPriorityRequests <= totalOpenPriorityRequests, "ZkLink: invalid state of pr");

        // overflow is impossible
        totalBlocksCommitted += uint32(_newBlocksData.length);

        // log the last new committed block number
        emit BlockCommit(_lastCommittedBlockData.blockNumber);
    }

    /// @notice Blocks commitment verification.
    /// @dev Only verifies block commitments without any other processing
    function proveBlocks(StoredBlockInfo[] memory _committedBlocks, ProofInput memory _proof) external nonReentrant {
        // ===Checks===
        uint32 currentTotalBlocksProven = totalBlocksProven;
        for (uint256 i = 0; i < _committedBlocks.length; ++i) {
            require(hashStoredBlockInfo(_committedBlocks[i]) == storedBlockHashes[currentTotalBlocksProven + 1], "ZkLink: incorrect commit block");
            ++currentTotalBlocksProven;

            require(_proof.commitments[i] & INPUT_MASK == uint256(_committedBlocks[i].commitment) & INPUT_MASK, "ZkLink: incorrect block commitment in proof");
        }

        // ===Effects===
        require(currentTotalBlocksProven <= totalBlocksCommitted, "ZkLink: invalid state of tbc");
        totalBlocksProven = currentTotalBlocksProven;

        // ===Interactions===
        bool success = verifier.verifyAggregatedBlockProof(
            _proof.recursiveInput,
            _proof.proof,
            _proof.vkIndexes,
            _proof.commitments,
            _proof.subproofsLimbs
        );
        require(success, "ZkLink: aggregated proof verification failed");
    }

    /// @notice Reverts unverified blocks
    function revertBlocks(StoredBlockInfo[] memory _blocksToRevert) external onlyValidator nonReentrant {
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

    /// @notice Execute blocks, completing priority operations and processing withdrawals.
    /// @dev 1. Processes all pending operations (Send Exits, Complete priority requests)
    /// 2. Finalizes block on Ethereum
    function executeBlocks(ExecuteBlockInfo[] memory _blocksData) external active onlyValidator nonReentrant {
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
        require(totalBlocksExecuted <= totalBlocksProven, "ZkLink: invalid state of tbp");
    }

    // =================Internal functions=================

    function deposit(address _tokenAddress, uint128 _amount, address _zkLinkAddress, uint8 _subAccountId) internal active {
        // ===Checks===
        // to prevent ddos
        require(totalOpenPriorityRequests < MAX_PRIORITY_REQUESTS, "ZkLink: too many request");
        // token MUST be registered to ZkLink and deposit MUST be enabled
        uint16 tokenId = governance.getTokenId(_tokenAddress);
        Governance.RegisteredToken memory rt = governance.getToken(tokenId);
        require(rt.registered, "ZkLink: token not registered");
        require(!rt.paused, "ZkLink: deposit paused");
        // disable deposit to zero address or with zero amount
        require(_amount > 0 && _amount <= MAX_DEPOSIT_AMOUNT, "ZkLink: invalid amount");
        require(_zkLinkAddress != address(0), "ZkLink: address not set");
        // subAccountId MUST be valid
        require(_subAccountId <= MAX_SUB_ACCOUNT_ID, "ZkLink: invalid subAccountId");

        // ===Effects===
        // Priority Queue request
        Operations.Deposit memory op =
        Operations.Deposit({
            chainId: CHAIN_ID,
            accountId: 0, // unknown at this point
            subAccountId: _subAccountId,
            owner: _zkLinkAddress,
            tokenId: tokenId,
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
        uint64 expirationBlock = uint64(block.number + PRIORITY_EXPIRATION);

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

    function increaseBalanceToWithdraw(bytes22 _packedBalanceKey, uint128 _amount) internal {
        uint128 balance = pendingBalances[_packedBalanceKey];
        pendingBalances[_packedBalanceKey] = balance.add(_amount);
    }

    /// @dev Process one block commit using previous block StoredBlockInfo,
    /// returns new block StoredBlockInfo
    /// NOTE: Does not change storage (except events, so we can't mark it view)
    function commitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock) internal view returns (StoredBlockInfo memory storedNewBlock)
    {
        require(_newBlock.blockNumber == _previousBlock.blockNumber + 1, "ZkLink: not commit next block");

        // Check timestamp of the new block
        {
            require(_newBlock.timestamp >= _previousBlock.timestamp, "ZkLink: block should be after previous block");
            // MUST be in a range of [block.timestamp - COMMIT_TIMESTAMP_NOT_OLDER, block.timestamp + COMMIT_TIMESTAMP_APPROXIMATION_DELTA]
            require(block.timestamp.sub(COMMIT_TIMESTAMP_NOT_OLDER) <= _newBlock.timestamp &&
                _newBlock.timestamp <= block.timestamp.add(COMMIT_TIMESTAMP_APPROXIMATION_DELTA), "ZkLink: invalid new block timestamp");
        }

        // Check onchain operations
        (bytes32 pendingOnchainOpsHash, uint64 priorityReqCommitted, bytes memory onchainOpsOffsetCommitment) =
        collectOnchainOps(_newBlock);

        // Create block commitment for verification proof
        bytes32 commitment = periphery.createBlockCommitment(_previousBlock.stateHash,
            _newBlock.blockNumber,
            _newBlock.feeAccount,
            _newBlock.newStateHash,
            _newBlock.timestamp,
            _newBlock.publicData,
            onchainOpsOffsetCommitment);

        return StoredBlockInfo(
            _newBlock.blockNumber,
            priorityReqCommitted,
            pendingOnchainOpsHash,
            _newBlock.timestamp,
            _newBlock.newStateHash,
            commitment
        );
    }

    /// @dev Gets operations packed in bytes array. Unpacks it and stores onchain operations.
    /// Priority operations must be committed in the same order as they are in the priority queue.
    /// NOTE: does not change storage! (only emits events)
    /// processableOperationsHash - hash of the all operations that needs to be executed  (Withdraws, ForcedExits, FullExits)
    /// priorityOperationsProcessed - number of priority operations processed in this block (Deposits, FullExits)
    /// offsetsCommitment - array where 1 is stored in chunk where onchainOperation begins and other are 0 (used in commitments)
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

        // pubdata length must be a multiple of CHUNK_BYTES
        require(pubData.length % CHUNK_BYTES == 0, "ZkLink: invalid pubdata length");
        offsetsCommitment = new bytes(pubData.length / CHUNK_BYTES);
        // NOTE: we MUST ignore ops that are not part of the current chain
        for (uint256 i = 0; i < _newBlockData.onchainOperations.length; ++i) {
            OnchainOperationData memory onchainOpData = _newBlockData.onchainOperations[i];

            uint256 pubdataOffset = onchainOpData.publicDataOffset;
            require(pubdataOffset < pubData.length, "ZkLink: publicDataOffset overflow");
            require(pubdataOffset % CHUNK_BYTES == 0, "ZkLink: offsets should be on chunks boundaries");
            uint256 chunkId = pubdataOffset / CHUNK_BYTES;
            require(offsetsCommitment[chunkId] == 0x00, "ZkLink: offset commitment should be empty");
            offsetsCommitment[chunkId] = bytes1(0x01);

            Operations.OpType opType = Operations.OpType(uint8(pubData[pubdataOffset]));

            if (opType == Operations.OpType.Deposit) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, DEPOSIT_BYTES);
                Operations.Deposit memory op = Operations.readDepositPubdata(opPubData);
                if (op.chainId == CHAIN_ID) {
                    Operations.checkPriorityOperation(op, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                    priorityOperationsProcessed++;
                }
            } else if (opType == Operations.OpType.ChangePubKey) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, CHANGE_PUBKEY_BYTES);
                Operations.ChangePubKey memory op = Operations.readChangePubKeyPubdata(opPubData);
                if (op.chainId == CHAIN_ID) {
                    if (onchainOpData.ethWitness.length != 0) {
                        bool valid = periphery.verifyChangePubkey(onchainOpData.ethWitness, op.accountId, op.pubKeyHash, op.owner, op.nonce);
                        require(valid, "ZkLink: verifyChangePubkey failed");
                    } else {
                        bool valid = authFacts[op.owner][op.nonce] == keccak256(abi.encodePacked(op.pubKeyHash));
                        require(valid, "ZkLink: new pub key hash not authenticated");
                    }
                }
            } else {
                bytes memory opPubData;

                if (opType == Operations.OpType.Withdraw) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, WITHDRAW_BYTES);
                } else if (opType == Operations.OpType.ForcedExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FORCED_EXIT_BYTES);
                } else if (opType == Operations.OpType.FullExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FULL_EXIT_BYTES);

                    Operations.FullExit memory fullExitData = Operations.readFullExitPubdata(opPubData);
                    if (fullExitData.chainId == CHAIN_ID) {
                        Operations.checkPriorityOperation(fullExitData, priorityRequests[uncommittedPriorityRequestsOffset + priorityOperationsProcessed]);
                        priorityOperationsProcessed++;
                    }
                } else {
                    revert("ZkLink: unsupported op");
                }

                processableOperationsHash = Utils.concatHash(processableOperationsHash, opPubData);
            }
        }
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
            "ZkLink: exec block not committed"
        );
        require(_blockExecuteData.storedBlock.blockNumber == totalBlocksExecuted + _executedBlockIdx + 1, "ZkLink: invalid exec order");

        bytes32 pendingOnchainOpsHash = EMPTY_STRING_KECCAK;
        for (uint32 i = 0; i < _blockExecuteData.pendingOnchainOpsPubdata.length; ++i) {
            bytes memory pubData = _blockExecuteData.pendingOnchainOpsPubdata[i];

            Operations.OpType opType = Operations.OpType(uint8(pubData[0]));
            if (opType == Operations.OpType.Withdraw) {
                Operations.Withdraw memory op = Operations.readWithdrawPubdata(pubData);
                if (op.chainId == CHAIN_ID) {
                    if (op.isFastWithdraw) {
                        bytes32 fwHash = periphery.calAcceptHash(op.owner, op.tokenId, op.amount, op.fastWithdrawFeeRate, op.nonce);
                        address accepter = periphery.getAccepter(fwHash);
                        if (accepter == address(0)) {
                            // receiver act as a accepter
                            periphery.setAccepter(fwHash, op.owner);
                            withdrawOrStore(op.tokenId, op.owner, op.amount);
                        } else {
                            // just increase the pending balance of accepter
                            increasePendingBalance(op.tokenId, accepter, op.amount);
                        }
                    } else {
                        withdrawOrStore(op.tokenId, op.owner, op.amount);
                    }
                }
            } else if (opType == Operations.OpType.ForcedExit) {
                Operations.ForcedExit memory op = Operations.readForcedExitPubdata(pubData);
                if (op.chainId == CHAIN_ID) {
                    withdrawOrStore(op.tokenId, op.target, op.amount);
                }
            } else if (opType == Operations.OpType.FullExit) {
                Operations.FullExit memory op = Operations.readFullExitPubdata(pubData);
                if (op.chainId == CHAIN_ID) {
                    withdrawOrStore(op.tokenId, op.owner, op.amount);
                }
            } else {
                revert("ZkLink: invalid op");
            }
            pendingOnchainOpsHash = Utils.concatHash(pendingOnchainOpsHash, pubData);
        }
        require(pendingOnchainOpsHash == _blockExecuteData.storedBlock.pendingOnchainOperationsHash, "ZkLink: incorrect onchain ops executed");
    }

    /// @dev 1. Try to send token to _recipients
    /// 2. On failure: Increment _recipients balance to withdraw.
    function withdrawOrStore(
        uint16 _tokenId,
        address _recipient,
        uint128 _amount
    ) internal {
        Governance.RegisteredToken memory rt = governance.getToken(_tokenId);
        if (!rt.registered) {
            increasePendingBalance(_tokenId, _recipient, _amount);
            return;
        }
        address tokenAddress = rt.tokenAddress;
        bool sent = false;
        if (tokenAddress == ETH_ADDRESS) {
            address payable toPayable = address(uint160(_recipient));
            sent = sendETHNoRevert(toPayable, _amount);
        } else {
            // We use `transferERC20` here to check that `ERC20` token indeed transferred `_amount`
            // and fail if token subtracted from zkLink balance more then `_amount` that was requested.
            // This can happen if token subtracts fee from sender while transferring `_amount` that was requested to transfer.
            try this.transferERC20{gas: WITHDRAWAL_GAS_LIMIT}(IERC20(tokenAddress), _recipient, _amount, _amount) {
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
    function increasePendingBalance(
        uint16 _tokenId,
        address _recipient,
        uint128 _amount
    ) internal {
        bytes22 packedBalanceKey = packAddressAndTokenId(_recipient, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        emit WithdrawalPending(_tokenId, _recipient, _amount);
    }

    /// @notice Sends ETH
    /// @param _to Address of recipient
    /// @param _amount Amount of tokens to transfer
    /// @return bool flag indicating that transfer is successful
    function sendETHNoRevert(address payable _to, uint256 _amount) internal returns (bool) {
        (bool callSuccess, ) = _to.call{gas: WITHDRAWAL_GAS_LIMIT, value: _amount}("");
        return callSuccess;
    }
}
