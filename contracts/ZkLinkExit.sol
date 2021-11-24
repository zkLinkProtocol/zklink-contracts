// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Utils.sol";
import "./ZkLinkBase.sol";

/// @title ZkLink main contract part 3: exit, auth, accept, withdraw pending
/// @author zk.link
contract ZkLinkExit is ZkLinkBase {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

    /// @notice Checks if Exodus mode must be entered. If true - enters exodus mode and emits ExodusMode event.
    /// @dev Exodus mode must be entered in case of current ethereum block number is higher than the oldest
    /// @dev of existed priority requests expiration block number.
    /// @return bool flag that is true if the Exodus mode must be entered.
    function activateExodusMode() public returns (bool) {
        bool trigger =
        block.number >= priorityRequests[firstPriorityRequestId].expirationBlock &&
        priorityRequests[firstPriorityRequestId].expirationBlock != 0;
        if (trigger) {
            if (!exodusMode) {
                exodusMode = true;
                emit ExodusMode();
            }
            return true;
        } else {
            return false;
        }
    }

    /// @notice Withdraws token from ZkLink to root chain in case of exodus mode. User must provide proof that he owns funds
    /// @param _storedBlockInfo Last verified block
    /// @param _owner Owner of the account
    /// @param _accountId Id of the account in the tree
    /// @param _proof Proof
    /// @param _tokenId Verified token id
    /// @param _amount Amount for owner (must be total amount, not part of it)
    function performExodus(
        StoredBlockInfo memory _storedBlockInfo,
        address _owner,
        uint32 _accountId,
        uint16 _tokenId,
        uint128 _amount,
        uint256[] memory _proof
    ) external nonReentrant {
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        require(exodusMode, "s"); // must be in exodus mode
        require(!performedExodus[_accountId][_tokenId], "t"); // already exited
        require(storedBlockHashes[totalBlocksExecuted] == hashStoredBlockInfo(_storedBlockInfo), "u"); // incorrect sotred block info

        bool proofCorrect =
        verifier.verifyExitProof(_storedBlockInfo.stateHash, _accountId, _owner, _tokenId, _amount, _proof);
        require(proofCorrect, "x");

        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        performedExodus[_accountId][_tokenId] = true;
    }

    /// @notice Accrues users balances from deposit priority requests in Exodus mode
    /// @dev WARNING: Only for Exodus mode
    /// @dev Canceling may take several separate transactions to be completed
    /// @param _n number of requests to process
    function cancelOutstandingDepositsForExodusMode(uint64 _n, bytes[] memory _depositsPubdata) external nonReentrant {
        require(exodusMode, "8"); // exodus mode not active
        uint64 toProcess = Utils.minU64(totalOpenPriorityRequests, _n);
        require(toProcess == _depositsPubdata.length, "A");
        require(toProcess > 0, "9"); // no deposits to process
        uint64 currentDepositIdx = 0;
        for (uint64 id = firstPriorityRequestId; id < firstPriorityRequestId + toProcess; id++) {
            if (priorityRequests[id].opType == Operations.OpType.Deposit ||
            priorityRequests[id].opType == Operations.OpType.QuickSwap ||
            priorityRequests[id].opType == Operations.OpType.Mapping ||
                priorityRequests[id].opType == Operations.OpType.L1AddLQ) {
                bytes memory depositPubdata = _depositsPubdata[currentDepositIdx];
                require(Utils.hashBytesToBytes20(depositPubdata) == priorityRequests[id].hashedPubData, "a");
                ++currentDepositIdx;

                bytes22 packedBalanceKey;
                uint128 amount;
                if (priorityRequests[id].opType == Operations.OpType.Deposit) {
                    Operations.Deposit memory op = Operations.readDepositPubdata(depositPubdata);
                    packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                    amount = op.amount;
                } else if (priorityRequests[id].opType == Operations.OpType.QuickSwap) {
                    Operations.QuickSwap memory op = Operations.readQuickSwapPubdata(depositPubdata);
                    packedBalanceKey = packAddressAndTokenId(op.owner, op.fromTokenId);
                    amount = op.amountIn;
                } else if (priorityRequests[id].opType == Operations.OpType.Mapping) {
                    Operations.Mapping memory op = Operations.readMappingPubdata(depositPubdata);
                    packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                    amount = op.amount;
                } else {
                    Operations.L1AddLQ memory op = Operations.readL1AddLQPubdata(depositPubdata);
                    packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                    amount = op.amount;
                    // revoke nft
                    governance.nft().revokeAddLq(op.nftTokenId);
                }
                pendingBalances[packedBalanceKey].balanceToWithdraw += amount;
            }
            delete priorityRequests[id];
        }
        firstPriorityRequestId += toProcess;
        totalOpenPriorityRequests -= toProcess;
    }

    /// @notice Set data for changing pubkey hash using onchain authorization.
    ///         Transaction author (msg.sender) should be L2 account address
    /// @notice New pubkey hash can be reset, to do that user should send two transactions:
    ///         1) First `setAuthPubkeyHash` transaction for already used `_nonce` will set timer.
    ///         2) After `AUTH_FACT_RESET_TIMELOCK` time is passed second `setAuthPubkeyHash` transaction will reset pubkey hash for `_nonce`.
    /// @param _pubkey_hash New pubkey hash
    /// @param _nonce Nonce of the change pubkey L2 transaction
    function setAuthPubkeyHash(bytes calldata _pubkey_hash, uint32 _nonce) external {
        require(_pubkey_hash.length == PUBKEY_HASH_BYTES, "y"); // PubKeyHash should be 20 bytes.
        if (authFacts[msg.sender][_nonce] == bytes32(0)) {
            authFacts[msg.sender][_nonce] = keccak256(_pubkey_hash);
        } else {
            uint256 currentResetTimer = authFactsResetTimer[msg.sender][_nonce];
            if (currentResetTimer == 0) {
                authFactsResetTimer[msg.sender][_nonce] = block.timestamp;
            } else {
                require(block.timestamp.sub(currentResetTimer) >= AUTH_FACT_RESET_TIMELOCK, "z");
                authFactsResetTimer[msg.sender][_nonce] = 0;
                authFacts[msg.sender][_nonce] = keccak256(_pubkey_hash);
            }
        }
    }

    /// @notice Accepter accept a fast withdraw, accepter will get a fee of (amount - amountOutMin)
    /// @param accepter Accepter
    /// @param receiver User receive token from accepter
    /// @param tokenId Token id
    /// @param amount Fast withdraw amount
    /// @param withdrawFee Fast withdraw fee taken by accepter
    /// @param nonce Used to produce unique accept info
    function accept(address accepter, address receiver, uint16 tokenId, uint128 amount, uint16 withdrawFee, uint32 nonce) external payable {
        uint128 fee = amount * withdrawFee / MAX_WITHDRAW_FEE;
        uint128 amountReceive = amount - fee;
        require(amountReceive > 0 && amountReceive <= amount, 'ZkLink: amountReceive');

        bytes32 hash = keccak256(abi.encodePacked(receiver, tokenId, amount, withdrawFee, nonce));
        _accept(accepter, receiver, tokenId, amountReceive, hash);
    }

    /// @notice Accepter accept a quick swap
    /// @param accepter Accepter
    /// @param receiver User receive token from accepter
    /// @param toTokenId Swap to token id
    /// @param amountOut Swap amount out
    /// @param acceptTokenId Token user really want to receive
    /// @param acceptAmountOutMin Token amount min user really want to receive
    /// @param nonce Used to produce unique accept info
    function acceptQuickSwap(address accepter, address receiver, uint16 toTokenId, uint128 amountOut, uint16 acceptTokenId, uint128 acceptAmountOutMin, uint32 nonce) external payable {
        bytes32 hash = keccak256(abi.encodePacked(receiver, toTokenId, amountOut, acceptTokenId, acceptAmountOutMin, nonce));
        _accept(accepter, receiver, acceptTokenId, acceptAmountOutMin, hash);
    }

    function _accept(address accepter, address receiver, uint16 tokenId, uint128 amountReceive, bytes32 hash) internal {
        require(accepts[hash] == address(0), 'ZkLink: accepted');
        accepts[hash] = accepter;

        // send token to receiver from msg.sender
        if (tokenId == 0) {
            // accepter should transfer at least amountReceive platform token to this contract
            require(msg.value >= amountReceive, 'ZkLink: accept msg value');
            payable(receiver).transfer(amountReceive);
            // if there are any left return back to accepter
            if (msg.value > amountReceive) {
                payable(msg.sender).transfer(msg.value - amountReceive);
            }
        } else {
            address tokenAddress = governance.tokenAddresses(tokenId);
            governance.validateTokenAddress(tokenAddress);
            // transfer erc20 token from accepter to receiver directly
            if (msg.sender != accepter) {
                require(brokerAllowance(tokenId, accepter, msg.sender) >= amountReceive, 'ZkLink: broker allowance');
                brokerAllowances[tokenId][accepter][msg.sender] -= amountReceive;
            }
            require(Utils.transferFromERC20(IERC20(tokenAddress), accepter, receiver, amountReceive), 'ZkLink: transferFrom failed');
        }
        emit Accept(accepter, receiver, tokenId, amountReceive);
    }

    function brokerAllowance(uint16 tokenId, address owner, address spender) public view returns (uint128) {
        return brokerAllowances[tokenId][owner][spender];
    }

    function brokerApprove(uint16 tokenId, address spender, uint128 amount) external returns (bool) {
        address tokenAddress = governance.tokenAddresses(tokenId);
        governance.validateTokenAddress(tokenAddress);
        require(spender != address(0), "ZkLink: approve to the zero address");
        brokerAllowances[tokenId][msg.sender][spender] = amount;
        return true;
    }

    /// @notice Returns amount of tokens that can be withdrawn by `address` from ZkLink contract
    /// @param _address Address of the tokens owner
    /// @param _token Address of token, zero address is used for ETH
    function getPendingBalance(address _address, address _token) public view returns (uint128) {
        uint16 tokenId = 0;
        if (_token != address(0)) {
            tokenId = governance.validateTokenAddress(_token);
        }
        return pendingBalances[packAddressAndTokenId(_address, tokenId)].balanceToWithdraw;
    }

    /// @notice Returns amount of tokens that can be withdrawn by `address` from ZkLink contract
    /// @param _address Address of the tokens owner
    /// @param _tokens Address of tokens, zero address is used for ETH
    function getPendingBalances(address _address, address[] memory _tokens) public view returns (uint128[] memory) {
        uint128[] memory balances = new uint128[](_tokens.length);
        for(uint256 i = 0; i < _tokens.length; i++) {
            balances[i] = getPendingBalance(_address, _tokens[i]);
        }
        return balances;
    }

    /// @notice  Withdraws multiple tokens from ZkLink contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _tokens Address of tokens, zero address is used for ETH
    /// @param _amounts Amount to withdraw to request.
    function withdrawMultiplePendingBalance(
        address payable _owner,
        address[] memory _tokens,
        uint128[] memory _amounts
    ) external nonReentrant {
        require(_tokens.length > 0 && _tokens.length == _amounts.length, 'ZkLink: withdraw length');
        for(uint256 i = 0; i < _tokens.length; i++) {
            _withdrawPendingBalance(_owner, _tokens[i], _amounts[i]);
        }
    }

    /// @notice  Withdraws tokens from ZkLink contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _token Address of tokens, zero address is used for ETH
    /// @param _amount Amount to withdraw to request.
    ///         NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token ZkLink contract
    ///         balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    function withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount
    ) external nonReentrant {
        _withdrawPendingBalance(_owner, _token, _amount);
    }

    function _withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount
    ) internal {
        // eth and non lp erc20 token is managed by vault and withdraw from vault
        uint16 tokenId;
        if (_token != address(0)) {
            tokenId = governance.validateTokenAddress(_token);
        }
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, tokenId);
        uint128 balance = pendingBalances[packedBalanceKey].balanceToWithdraw;
        if (_amount > balance) {
            _amount = balance;
        }
        require(_amount > 0, 'ZkLink: withdraw amount');

        pendingBalances[packedBalanceKey].balanceToWithdraw = balance.sub(_amount);
        vault.withdraw(tokenId, _owner, _amount);
        emit Withdrawal(tokenId, _amount);
    }
}
