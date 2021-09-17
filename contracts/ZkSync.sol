// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./SafeMath.sol";
import "./SafeMathUInt128.sol";
import "./SafeCast.sol";
import "./Utils.sol";

import "./Operations.sol";

import "./UpgradeableMaster.sol";
import "./ZkSyncBase.sol";

/// @title zkSync main contract part 1: deposit, withdraw
/// @author Matter Labs
/// @author ZkLink Labs
contract ZkSync is UpgradeableMaster, ZkSyncBase {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

    bytes32 private constant EMPTY_STRING_KECCAK = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    // Upgrade functional

    /// @notice Notice period before activation preparation status of upgrade mode
    function getNoticePeriod() external pure override returns (uint256) {
        return UPGRADE_NOTICE_PERIOD;
    }

    /// @notice Notification that upgrade notice period started
    /// @dev Can be external because Proxy contract intercepts illegal calls of this function
    function upgradeNoticePeriodStarted() external override {}

    /// @notice Notification that upgrade preparation status is activated
    /// @dev Can be external because Proxy contract intercepts illegal calls of this function
    function upgradePreparationStarted() external override {
        upgradePreparationActive = true;
        upgradePreparationActivationTime = block.timestamp;
    }

    /// @notice Notification that upgrade canceled
    /// @dev Can be external because Proxy contract intercepts illegal calls of this function
    function upgradeCanceled() external override {
        upgradePreparationActive = false;
        upgradePreparationActivationTime = 0;
    }

    /// @notice Notification that upgrade finishes
    /// @dev Can be external because Proxy contract intercepts illegal calls of this function
    function upgradeFinishes() external override {
        upgradePreparationActive = false;
        upgradePreparationActivationTime = 0;
    }

    /// @notice Checks that contract is ready for upgrade
    /// @return bool flag indicating that contract is ready for upgrade
    function isReadyForUpgrade() external view override returns (bool) {
        return !exodusMode;
    }

    /// @notice zkSync contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    /// @dev _governanceAddress The address of Governance contract
    /// @dev _verifierAddress The address of Verifier contract
    /// @dev _zkSyncBlock The address of ZkSyncBlock contract
    /// @dev _pairManagerAddress The address of UniswapV2Factory contract
    /// @dev _vaultAddress The address of Vault contract
    /// @dev _genesisStateHash Genesis blocks (first block) state tree root hash
    function initialize(bytes calldata initializationParameters) external {
        initializeReentrancyGuard();

        (address _governanceAddress, address _verifierAddress, address _zkSyncBlock, address payable _vaultAddress, bytes32 _genesisStateHash) =
            abi.decode(initializationParameters, (address, address, address, address, bytes32));

        verifier = Verifier(_verifierAddress);
        governance = Governance(_governanceAddress);
        zkSyncBlock = _zkSyncBlock;
        vault = IVault(_vaultAddress);

        // We need initial state hash because it is used in the commitment of the next block
        StoredBlockInfo memory storedBlockZero =
            StoredBlockInfo(0, 0, EMPTY_STRING_KECCAK, 0, _genesisStateHash, bytes32(0));

        storedBlockHashes[0] = hashStoredBlockInfo(storedBlockZero);
    }

    /// @notice zkSync contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    function upgrade(bytes calldata upgradeParameters) external nonReentrant {
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

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    /// @param _zkSyncAddress The receiver Layer 2 address
    function depositETH(address _zkSyncAddress) external payable {
        requireActive();
        require(msg.value > 0, 'ZkSync: deposit amount');

        (bool success, ) = payable(address(vault)).call{value: msg.value}("");
        require(success, "ZkSync: eth transfer failed");
        vault.recordDeposit(0);
        registerDeposit(0, SafeCast.toUint128(msg.value), _zkSyncAddress);
    }

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    /// @param _token Token address
    /// @param _amount Token amount
    /// @param _zkSyncAddress Receiver Layer 2 address
    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        address _zkSyncAddress
    ) external nonReentrant {
        requireActive();
        require(_amount > 0, 'ZkSync: deposit amount');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
        registerDeposit(tokenId, _amount, _zkSyncAddress);
    }

    /// @notice Swap ETH from this chain to another token(this chain or another chain) - transfer ETH from user into contract, validate it, register swap
    /// @param _zkSyncAddress Receiver Layer 2 address if swap failed
    /// @param _amountOutMin Minimum receive amount of to token when no fast withdraw
    /// @param _withdrawFee Withdraw fee, 100 means 1%
    /// @param _toChainId Chain id of to token
    /// @param _toTokenId Swap token to
    /// @param _to To token received address
    /// @param _nonce Used to produce unique accept info
    function swapExactETHForTokens(address _zkSyncAddress, uint104 _amountOutMin, uint16 _withdrawFee, uint8 _toChainId, uint16 _toTokenId, address _to, uint32 _nonce) external payable {
        requireActive();
        require(msg.value > 0, 'ZkSync: amountIn');
        require(_withdrawFee < MAX_WITHDRAW_FEE, 'ZkSync: withdrawFee');

        (bool success, ) = payable(address(vault)).call{value: msg.value}("");
        require(success, "ZkSync: eth transfer failed");
        vault.recordDeposit(0);
        registerQuickSwap(_zkSyncAddress, SafeCast.toUint128(msg.value), _amountOutMin, _withdrawFee, 0, _toChainId, _toTokenId, _to, _nonce);
    }

    /// @notice Swap ERC20 token from this chain to another token(this chain or another chain) - transfer ERC20 tokens from user into contract, validate it, register swap
    /// @param _zkSyncAddress Receiver Layer 2 address if swap failed
    /// @param _amountIn Swap amount of from token
    /// @param _amountOutMin Minimum swap out amount of to token
    /// @param _withdrawFee Withdraw fee, 100 means 1%
    /// @param _fromToken Swap token from
    /// @param _toChainId Chain id of to token
    /// @param _toTokenId Swap token to
    /// @param _to To token received address
    /// @param _nonce Used to produce unique accept info
    function swapExactTokensForTokens(address _zkSyncAddress, uint104 _amountIn, uint104 _amountOutMin, uint16 _withdrawFee, IERC20 _fromToken, uint8 _toChainId, uint16 _toTokenId, address _to, uint32 _nonce) external {
        requireActive();
        require(_amountIn > 0, 'ZkSync: amountIn');
        require(_withdrawFee < MAX_WITHDRAW_FEE, 'ZkSync: withdrawFee');

        // Get token id by its address
        uint16 fromTokenId = governance.validateTokenAddress(address(_fromToken));
        require(!governance.pausedTokens(fromTokenId), "b"); // token deposits are paused

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_fromToken, msg.sender, address(vault), _amountIn), "c"); // token transfer failed deposit
        vault.recordDeposit(fromTokenId);
        registerQuickSwap(_zkSyncAddress, _amountIn, _amountOutMin, _withdrawFee, fromTokenId, _toChainId, _toTokenId, _to, _nonce);
    }

    /// @notice Mapping ERC20 from this chain to another chain - transfer ERC20 tokens from user into contract, validate it, register mapping
    /// @param _zkSyncAddress Receiver Layer 2 address if mapping failed
    /// @param _to Address in to chain to receive token
    /// @param _amount Mapping amount of token
    /// @param _token Mapping token
    /// @param _toChainId Chain id of to token
    function mappingToken(address _zkSyncAddress, address _to, uint104 _amount, IERC20 _token, uint8 _toChainId) external {
        requireActive();
        require(_amount > 0, 'ZkSync: amount');
        require(_toChainId != CHAIN_ID, 'ZkSync: toChainId');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused
        require(governance.mappingTokens(tokenId), 'ZkSync: not mapping token');

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
        registerTokenMapping(_zkSyncAddress, _to, _amount, tokenId, _toChainId);
    }

    /// @notice Add token to l2 cross chain pair
    /// @param _zkSyncAddress Receiver Layer 2 address if add liquidity failed
    /// @param _token Token added
    /// @param _amount Amount of token
    /// @param _pair L2 cross chain pair address
    /// @param _minLpAmount L2 lp token amount min received
    function addLiquidity(address _zkSyncAddress, IERC20 _token, uint104 _amount, address _pair, uint104 _minLpAmount) external {
        requireActive();
        require(_amount > 0, 'ZkSync: amount');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused
        // nft must exist
        require(address(governance.nft()) != address(0), 'ZkSync: nft not exist');

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
        // mint a pending nft to user
        uint32 nftTokenId = governance.nft().addLq(_zkSyncAddress, tokenId, _amount, _pair);
        registerAddLiquidity(_zkSyncAddress, tokenId, _amount, _pair, _minLpAmount, nftTokenId);
    }

    /// @notice Returns amount of tokens that can be withdrawn by `address` from zkSync contract
    /// @param _address Address of the tokens owner
    /// @param _token Address of token, zero address is used for ETH
    function getPendingBalance(address _address, address _token) public view returns (uint128) {
        uint16 tokenId = 0;
        if (_token != address(0)) {
            tokenId = governance.validateTokenAddress(_token);
        }
        return pendingBalances[packAddressAndTokenId(_address, tokenId)].balanceToWithdraw;
    }

    /// @notice  Withdraws tokens from zkSync contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _token Address of tokens, zero address is used for ETH
    /// @param _amount Amount to withdraw to request.
    ///         NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token zkSync contract
    ///         balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    function withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount
    ) external nonReentrant {
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
        require(_amount > 0, 'ZkSync: withdraw amount');

        pendingBalances[packedBalanceKey].balanceToWithdraw = balance.sub(_amount);
        vault.withdraw(tokenId, _owner, _amount);
        emit Withdrawal(tokenId, _amount);
    }

    /// @notice Register full exit request - pack pubdata, add priority request
    /// @param _accountId Numerical id of the account
    /// @param _token Token address, 0 address for ether
    function requestFullExit(uint32 _accountId, address _token) public nonReentrant {
        requireActive();
        require(_accountId <= MAX_ACCOUNT_ID, "e");

        uint16 tokenId = 0;
        if (_token != address(0)) {
            tokenId = governance.validateTokenAddress(_token);
        }

        // Priority Queue request
        Operations.FullExit memory op =
            Operations.FullExit({
                accountId: _accountId,
                owner: msg.sender,
                tokenId: tokenId,
                amount: 0 // unknown at this point
            });
        bytes memory pubData = Operations.writeFullExitPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.FullExit, pubData);

        // User must fill storage slot of balancesToWithdraw(msg.sender, tokenId) with nonzero value
        // In this case operator should just overwrite this slot during confirming withdrawal
        bytes22 packedBalanceKey = packAddressAndTokenId(msg.sender, tokenId);
        pendingBalances[packedBalanceKey].gasReserveValue = FILLED_GAS_RESERVE_VALUE;
    }

    /// @notice Register deposit request - pack pubdata, add priority request and emit OnchainDeposit event
    /// @param _tokenId Token by id
    /// @param _amount Token amount
    /// @param _owner Receiver
    function registerDeposit(
        uint16 _tokenId,
        uint128 _amount,
        address _owner
    ) internal {
        // Priority Queue request
        Operations.Deposit memory op =
            Operations.Deposit({
                accountId: 0, // unknown at this point
                owner: _owner,
                tokenId: _tokenId,
                amount: _amount
            });
        bytes memory pubData = Operations.writeDepositPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.Deposit, pubData);
        emit Deposit(_tokenId, _amount);
    }

    /// @notice Register swap request - pack pubdata, add priority request and emit OnchainQuickSwap event
    function registerQuickSwap(
        address _owner,
        uint128 _amountIn,
        uint128 _amountOutMin,
        uint16 _withdrawFee,
        uint16 _fromTokenId,
        uint8 _toChainId,
        uint16 _toTokenId,
        address _to,
        uint32 _nonce
    ) internal {
        // Priority Queue request
        Operations.QuickSwap memory op =
            Operations.QuickSwap({
                fromChainId: CHAIN_ID,
                toChainId: _toChainId,
                owner: _owner,
                fromTokenId: _fromTokenId,
                amountIn: _amountIn,
                to: _to,
                toTokenId: _toTokenId,
                amountOutMin: _amountOutMin,
                withdrawFee: _withdrawFee,
                nonce: _nonce
            });
        bytes memory pubData = Operations.writeQuickSwapPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.QuickSwap, pubData);
        emit QuickSwap(_owner, _amountIn, _amountOutMin, _withdrawFee, _fromTokenId, _toChainId, _toTokenId, _to, _nonce);
    }

    /// @notice Register mapping request - pack pubdata, add priority request and emit OnchainMapping event
    function registerTokenMapping(
        address _owner,
        address _to,
        uint128 _amount,
        uint16 _tokenId,
        uint8 _toChainId
    ) internal {
        // Priority Queue request
        Operations.Mapping memory op =
            Operations.Mapping({
                fromChainId: CHAIN_ID,
                toChainId: _toChainId,
                owner: _owner,
                to: _to,
                tokenId: _tokenId,
                amount: _amount,
                fee: 0 // unknown at this point
                }
            );
        bytes memory pubData = Operations.writeMappingPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.Mapping, pubData);
        emit TokenMapping(_tokenId, _amount, _toChainId);
    }

    /// @notice Register add liquidity request - pack pubdata, add priority request and emit OnchainAddLiquidity event
    function registerAddLiquidity(
        address _owner,
        uint16 _tokenId,
        uint128 _amount,
        address _pair,
        uint128 _minLpAmount,
        uint32 _nftTokenId
    ) internal {
        // Priority Queue request
        Operations.L1AddLQ memory op =
        Operations.L1AddLQ({
                owner: _owner,
                chainId: CHAIN_ID,
                tokenId: _tokenId,
                amount: _amount,
                pair: _pair,
                lpAmount: _minLpAmount,
                nftTokenId: _nftTokenId
            }
        );
        bytes memory pubData = Operations.writeL1AddLQPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.L1AddLQ, pubData);
        emit AddLiquidity(_pair, _tokenId, _amount);
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

        priorityRequests[nextPriorityRequestId] = PriorityOperation({
            hashedPubData: hashedPubData,
            expirationBlock: expirationBlock,
            opType: _opType
        });

        emit NewPriorityRequest(msg.sender, nextPriorityRequestId, _opType, _pubData, uint256(expirationBlock));

        totalOpenPriorityRequests++;
    }

    /// @notice Will run when no functions matches call data
    fallback() external payable {
        _fallback();
    }

    /// @notice Same as fallback but called when calldata is empty
    receive() external payable {
        _fallback();
    }

    /// @notice Performs a delegatecall to the contract implementation
    /// @dev Fallback function allowing to perform a delegatecall to the given implementation
    /// This function will return whatever the implementation call returns
    function _fallback() internal {
        address _target = zkSyncBlock;
        require(_target != address(0), "f0");
        assembly {
            // The pointer to the free memory slot
            let ptr := mload(0x40)
            // Copy function signature and arguments from calldata at zero position into memory at pointer position
            calldatacopy(ptr, 0x0, calldatasize())
            // Delegatecall method of the implementation contract, returns 0 on error
            let result := delegatecall(gas(), _target, ptr, calldatasize(), 0x0, 0)
            // Get the size of the last return data
            let size := returndatasize()
            // Copy the size length of bytes from return data at zero position to pointer position
            returndatacopy(ptr, 0x0, size)
            // Depending on result value
            switch result
            case 0 {
            // End execution and revert state changes
                revert(ptr, size)
            }
            default {
            // Return data with length of size at pointers position
                return(ptr, size)
            }
        }
    }
}
