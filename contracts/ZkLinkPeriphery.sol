// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/ReentrancyGuard.sol";
import "./zksync/Events.sol";
import "./Storage.sol";
import "./zksync/Bytes.sol";
import "./zksync/Utils.sol";
import "./zksync/SafeMath.sol";
import "./zksync/SafeCast.sol";
import "./zksync/IERC20.sol";

/// @title ZkLink periphery contract
/// @author zk.link
contract ZkLinkPeriphery is ReentrancyGuard, Storage, Events {
    using SafeMath for uint256;

    // =================User interface=================

    /// @notice Checks if Exodus mode must be entered. If true - enters exodus mode and emits ExodusMode event.
    /// @dev Exodus mode must be entered in case of current ethereum block number is higher than the oldest
    /// of existed priority requests expiration block number.
    function activateExodusMode() external active nonReentrant {
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
    /// @param _srcTokenId The token deducted at l2
    /// @param _amount Amount for owner (must be total amount, not part of it)
    function performExodus(
        StoredBlockInfo calldata _storedBlockInfo,
        address _owner,
        uint32 _accountId,
        uint8 _subAccountId,
        uint16 _tokenId,
        uint16 _srcTokenId,
        uint128 _amount,
        uint256[] calldata _proof
    ) external notActive nonReentrant {
        // ===Checks===
        // performed exodus MUST not be already exited
        require(!performedExodus[_accountId][_subAccountId][_tokenId][_srcTokenId], "y0");
        // incorrect stored block info
        require(storedBlockHashes[totalBlocksExecuted] == hashStoredBlockInfo(_storedBlockInfo), "y1");
        // exit proof MUST be correct
        bool proofCorrect = verifier.verifyExitProof(_storedBlockInfo.stateHash, CHAIN_ID, _accountId, _subAccountId, _owner, _tokenId, _srcTokenId, _amount, _proof);
        require(proofCorrect, "y2");

        // ===Effects===
        performedExodus[_accountId][_subAccountId][_tokenId][_srcTokenId] = true;
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        emit WithdrawalPending(_tokenId, _owner, _amount);
    }

    /// @notice Accrues users balances from deposit priority requests in Exodus mode
    /// @dev WARNING: Only for Exodus mode
    /// Canceling may take several separate transactions to be completed
    /// @param _n number of requests to process
    /// @param _depositsPubdata deposit details
    function cancelOutstandingDepositsForExodusMode(uint64 _n, bytes[] calldata _depositsPubdata) external notActive nonReentrant {
        // ===Checks===
        uint64 toProcess = Utils.minU64(totalOpenPriorityRequests, _n);
        require(toProcess > 0, "A0");

        // ===Effects===
        uint64 currentDepositIdx = 0;
        for (uint64 id = firstPriorityRequestId; id < firstPriorityRequestId + toProcess; ++id) {
            Operations.PriorityOperation memory pr = priorityRequests[id];
            if (pr.opType == Operations.OpType.Deposit) {
                bytes memory depositPubdata = _depositsPubdata[currentDepositIdx];
                require(Utils.hashBytesToBytes20(depositPubdata) == pr.hashedPubData, "A1");
                ++currentDepositIdx;

                Operations.Deposit memory op = Operations.readDepositPubdata(depositPubdata);
                bytes22 packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                increaseBalanceToWithdraw(packedBalanceKey, op.amount);
            }
            delete priorityRequests[id];
        }
        // overflow is impossible
        firstPriorityRequestId += toProcess;
        totalOpenPriorityRequests -= toProcess;
    }

    /// @notice Set data for changing pubkey hash using onchain authorization.
    ///         Transaction author (msg.sender) should be L2 account address
    /// New pubkey hash can be reset, to do that user should send two transactions:
    ///         1) First `setAuthPubkeyHash` transaction for already used `_nonce` will set timer.
    ///         2) After `AUTH_FACT_RESET_TIMELOCK` time is passed second `setAuthPubkeyHash` transaction will reset pubkey hash for `_nonce`.
    /// @param _pubkeyHash New pubkey hash
    /// @param _nonce Nonce of the change pubkey L2 transaction
    function setAuthPubkeyHash(bytes calldata _pubkeyHash, uint32 _nonce) external active nonReentrant {
        require(_pubkeyHash.length == PUBKEY_HASH_BYTES, "B0"); // PubKeyHash should be 20 bytes.
        if (authFacts[msg.sender][_nonce] == bytes32(0)) {
            authFacts[msg.sender][_nonce] = keccak256(_pubkeyHash);
            emit FactAuth(msg.sender, _nonce, _pubkeyHash);
        } else {
            uint256 currentResetTimer = authFactsResetTimer[msg.sender][_nonce];
            if (currentResetTimer == 0) {
                authFactsResetTimer[msg.sender][_nonce] = block.timestamp;
            } else {
                require(block.timestamp.sub(currentResetTimer) >= AUTH_FACT_RESET_TIMELOCK, "B1"); // too early to reset auth
                authFactsResetTimer[msg.sender][_nonce] = 0;
                authFacts[msg.sender][_nonce] = keccak256(_pubkeyHash);
                emit FactAuth(msg.sender, _nonce, _pubkeyHash);
            }
        }
    }

    /// @notice Returns amount of tokens that can be withdrawn by `address` from zkLink contract
    /// @param _address Address of the tokens owner
    /// @param _tokenId Token id
    /// @return The pending balance can be withdrawn
    function getPendingBalance(address _address, uint16 _tokenId) external view returns (uint128) {
        return pendingBalances[packAddressAndTokenId(_address, _tokenId)];
    }

    // =======================Governance interface======================

    /// @notice Change current governor
    /// @param _newGovernor Address of the new governor
    function changeGovernor(address _newGovernor) external onlyGovernor {
        require(_newGovernor != address(0), "H");
        if (networkGovernor != _newGovernor) {
            networkGovernor = _newGovernor;
            emit NewGovernor(_newGovernor);
        }
    }

    /// @notice Add token to the list of networks tokens
    /// @param _tokenId Token id
    /// @param _tokenAddress Token address
    /// @param _standard If token is a standard erc20
    /// @param _mappingTokenId The mapping token id at l2
    function addToken(uint16 _tokenId, address _tokenAddress, bool _standard, uint16 _mappingTokenId) public onlyGovernor {
        // token id MUST be in a valid range
        require(_tokenId > 0 && _tokenId < MAX_AMOUNT_OF_REGISTERED_TOKENS, "I0");
        // token MUST be not zero address
        require(_tokenAddress != address(0), "I1");
        // revert duplicate register
        RegisteredToken memory rt = tokens[_tokenId];
        require(!rt.registered, "I2");
        require(tokenIds[_tokenAddress] == 0, "I2");

        rt.registered = true;
        rt.tokenAddress = _tokenAddress;
        rt.standard = _standard;
        rt.mappingTokenId = _mappingTokenId;
        tokens[_tokenId] = rt;
        tokenIds[_tokenAddress] = _tokenId;
        emit NewToken(_tokenId, _tokenAddress);
    }

    /// @notice Add tokens to the list of networks tokens
    /// @param _tokenIdList Token id list
    /// @param _tokenAddressList Token address list
    /// @param _standardList Token standard list
    /// @param _mappingTokenList Mapping token list
    function addTokens(uint16[] calldata _tokenIdList, address[] calldata _tokenAddressList, bool[] calldata _standardList, uint16[] calldata _mappingTokenList) external {
        for (uint i; i < _tokenIdList.length; i++) {
            addToken(_tokenIdList[i], _tokenAddressList[i], _standardList[i], _mappingTokenList[i]);
        }
    }

    /// @notice Pause token deposits for the given token
    /// @param _tokenId Token id
    /// @param _tokenPaused Token paused status
    function setTokenPaused(uint16 _tokenId, bool _tokenPaused) external onlyGovernor {
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "K");

        if (rt.paused != _tokenPaused) {
            rt.paused = _tokenPaused;
            tokens[_tokenId] = rt;
            emit TokenPausedUpdate(_tokenId, _tokenPaused);
        }
    }

    /// @notice Change validator status (active or not active)
    /// @param _validator Validator address
    /// @param _active Active flag
    function setValidator(address _validator, bool _active) external onlyGovernor {
        if (validators[_validator] != _active) {
            validators[_validator] = _active;
            emit ValidatorStatusUpdate(_validator, _active);
        }
    }

    /// @notice Add a new bridge
    /// @param bridge the bridge contract
    function addBridge(address bridge) external onlyGovernor {
        require(bridge != address(0), "L0");
        // the index of non-exist bridge is zero
        require(bridgeIndex[bridge] == 0, "L1");

        BridgeInfo memory info = BridgeInfo({
            bridge: bridge,
            enableBridgeTo: true,
            enableBridgeFrom: true
        });
        bridges.push(info);
        bridgeIndex[bridge] = bridges.length;
        emit AddBridge(bridge);
    }

    /// @notice Update bridge info
    /// @dev If we want to remove a bridge(not compromised), we should firstly set `enableBridgeTo` to false
    /// and wait all messages received from this bridge and then set `enableBridgeFrom` to false.
    /// But when a bridge is compromised, we must set both `enableBridgeTo` and `enableBridgeFrom` to false immediately
    /// @param index the bridge info index
    /// @param enableBridgeTo if set to false, bridge to will be disabled
    /// @param enableBridgeFrom if set to false, bridge from will be disabled
    function updateBridge(uint256 index, bool enableBridgeTo, bool enableBridgeFrom) external onlyGovernor {
        require(index < bridges.length, "M");
        BridgeInfo memory info = bridges[index];
        info.enableBridgeTo = enableBridgeTo;
        info.enableBridgeFrom = enableBridgeFrom;
        bridges[index] = info;
        emit UpdateBridge(index, enableBridgeTo, enableBridgeFrom);
    }

    function isBridgeToEnabled(address bridge) external view returns (bool) {
        uint256 index = bridgeIndex[bridge].sub(1);
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeTo;
    }

    function isBridgeFromEnabled(address bridge) public view returns (bool) {
        uint256 index = bridgeIndex[bridge].sub(1);
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeFrom;
    }

    // =======================Cross chain block synchronization======================

    /// @notice Combine the `progress` of the other chains of a `syncHash` with self
    function receiveSynchronizationProgress(bytes32 syncHash, uint256 progress) external {
        require(isBridgeFromEnabled(msg.sender), "C");

        synchronizedChains[syncHash] = synchronizedChains[syncHash] | progress;
    }

    /// @notice Get synchronized progress of current chain known
    function getSynchronizedProgress(StoredBlockInfo memory _block) public view returns (uint256 progress) {
        progress = synchronizedChains[_block.syncHash];
        // combine the current chain if it has proven this block
        if (_block.blockNumber <= totalBlocksProven &&
            hashStoredBlockInfo(_block) == storedBlockHashes[_block.blockNumber]) {
            progress |= CHAIN_INDEX;
        } else {
            // to prevent bridge from delivering a wrong progress
            progress &= ~CHAIN_INDEX;
        }
    }

    /// @notice Check if received all syncHash from other chains at the block height
    function syncBlocks(StoredBlockInfo memory _block) external nonReentrant {
        uint256 progress = getSynchronizedProgress(_block);
        require(progress == ALL_CHAINS, "D0");

        uint32 blockNumber = _block.blockNumber;
        require(blockNumber > totalBlocksSynchronized, "D1");

        totalBlocksSynchronized = blockNumber;
    }

    // =======================Fast withdraw and Accept======================

    /// @notice Accepter accept a eth fast withdraw, accepter will get a fee for profit
    /// @param accepter Accepter who accept a fast withdraw
    /// @param accountId Account that request fast withdraw
    /// @param receiver User receive token from accepter (the owner of withdraw operation)
    /// @param amount The amount of withdraw operation
    /// @param withdrawFeeRate Fast withdraw fee rate taken by accepter
    /// @param nonce Account nonce, used to produce unique accept info
    function acceptETH(address accepter,
        uint32 accountId,
        address payable receiver,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce) external payable nonReentrant {
        // ===Checks===
        uint16 tokenId = tokenIds[ETH_ADDRESS];
        (uint128 amountReceive, bytes32 hash, ) =
        _checkAccept(accepter, accountId, receiver, tokenId, amount, withdrawFeeRate, nonce);

        // ===Effects===
        accepts[accountId][hash] = accepter;

        // ===Interactions===
        // make sure msg value >= amountReceive
        uint256 amountReturn = msg.value.sub(amountReceive);
        // add gas limit to prevent gas minting attack
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{value: amountReceive, gas: WITHDRAWAL_GAS_LIMIT}("");
        require(success, "E0");
        // if send too more eth then return back to msg sender
        if (amountReturn > 0) {
            // it's safe to use call to msg.sender and can send all gas left to it
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = msg.sender.call{value: amountReturn}("");
            require(success, "E1");
        }
        emit Accept(accepter, accountId, receiver, tokenId, amountReceive, amountReceive);
    }

    /// @notice Accepter accept a erc20 token fast withdraw, accepter will get a fee for profit
    /// @param accepter Accepter who accept a fast withdraw
    /// @param accountId Account that request fast withdraw
    /// @param receiver User receive token from accepter (the owner of withdraw operation)
    /// @param tokenId Token id
    /// @param amount The amount of withdraw operation
    /// @param withdrawFeeRate Fast withdraw fee rate taken by accepter
    /// @param nonce Account nonce, used to produce unique accept info
    /// @param amountTransfer Amount that transfer from accepter to receiver
    /// may be a litter larger than the amount receiver received
    function acceptERC20(address accepter,
        uint32 accountId,
        address receiver,
        uint16 tokenId,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce,
        uint128 amountTransfer) external nonReentrant {
        // ===Checks===
        (uint128 amountReceive, bytes32 hash, address tokenAddress) =
        _checkAccept(accepter, accountId, receiver, tokenId, amount, withdrawFeeRate, nonce);

        // ===Effects===
        accepts[accountId][hash] = accepter;

        // ===Interactions===
        // stack too deep
        uint128 amountSent;
        {
            address _accepter = accepter;
            address _receiver = receiver;
            uint256 receiverBalanceBefore = IERC20(tokenAddress).balanceOf(_receiver);
            uint256 accepterBalanceBefore = IERC20(tokenAddress).balanceOf(_accepter);
            IERC20(tokenAddress).transferFrom(_accepter, _receiver, amountTransfer);
            uint256 receiverBalanceAfter = IERC20(tokenAddress).balanceOf(_receiver);
            uint256 accepterBalanceAfter = IERC20(tokenAddress).balanceOf(_accepter);
            uint128 receiverBalanceDiff = SafeCast.toUint128(receiverBalanceAfter.sub(receiverBalanceBefore));
            require(receiverBalanceDiff >= amountReceive, "F0");
            amountReceive = receiverBalanceDiff;
            // amountSent may be larger than amountReceive when the token is a non standard erc20 token
            amountSent = SafeCast.toUint128(accepterBalanceBefore.sub(accepterBalanceAfter));
        }
        if (msg.sender != accepter) {
            require(brokerAllowance(tokenId, accepter, msg.sender) >= amountSent, "F1");
            brokerAllowances[tokenId][accepter][msg.sender] -= amountSent;
        }
        emit Accept(accepter, accountId, receiver, tokenId, amountSent, amountReceive);
    }

    function brokerAllowance(uint16 tokenId, address owner, address spender) public view returns (uint128) {
        return brokerAllowances[tokenId][owner][spender];
    }

    /// @notice Give allowance to spender to call accept
    function brokerApprove(uint16 tokenId, address spender, uint128 amount) external returns (bool) {
        require(spender != address(0), "G");
        brokerAllowances[tokenId][msg.sender][spender] = amount;
        emit BrokerApprove(tokenId, msg.sender, spender, amount);
        return true;
    }

    function _checkAccept(address accepter,
        uint32 accountId,
        address receiver,
        uint16 tokenId,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce) internal active view returns (uint128 amountReceive, bytes32 hash, address tokenAddress) {
        // accepter and receiver MUST be set and MUST not be the same
        require(accepter != address(0), "H0");
        require(receiver != address(0), "H1");
        require(receiver != accepter, "H2");
        // token MUST be registered to ZkLink
        RegisteredToken memory rt = tokens[tokenId];
        require(rt.registered, "H3");
        tokenAddress = rt.tokenAddress;
        // feeRate MUST be valid
        require(withdrawFeeRate < MAX_ACCEPT_FEE_RATE, "H4");
        amountReceive = amount * (MAX_ACCEPT_FEE_RATE - withdrawFeeRate) / MAX_ACCEPT_FEE_RATE;
        // nonce MUST not be zero
        require(nonce > 0, "H5");

        // accept tx may be later than block exec tx(with user withdraw op)
        hash = keccak256(abi.encodePacked(receiver, tokenId, amount, withdrawFeeRate, nonce));
        require(accepts[accountId][hash] == address(0), "H6");
    }
}
