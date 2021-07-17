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

        (address _governanceAddress, address _verifierAddress, address _zkSyncBlock, address _pairManagerAddress, address payable _vaultAddress, bytes32 _genesisStateHash) =
            abi.decode(initializationParameters, (address, address, address, address, address, bytes32));

        verifier = Verifier(_verifierAddress);
        governance = Governance(_governanceAddress);
        zkSyncBlock = _zkSyncBlock;
        pairManager = IUniswapV2Factory(_pairManagerAddress);
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

    /// @notice Create pair
    /// @dev This function is used to creat pair
    /// @param _tokenA Token A address
    /// @param _tokenB Token B address
    function createPair(address _tokenA, address _tokenB) external {
        requireActive();
        governance.requireGovernor(msg.sender);
        // check _tokenA is registered or not
        uint16 tokenAID = governance.validateTokenAddress(_tokenA);
        // check _tokenB is registered or not
        uint16 tokenBID = governance.validateTokenAddress(_tokenB);

        // create pair
        address pair = pairManager.createPair(_tokenA, _tokenB);
        require(pair != address(0), "pair is invalid");

        addPairToken(pair);

        registerCreatePair(
            tokenAID, tokenBID,
            validatePairTokenAddress(pair),
            pair);
    }

    /// @notice Create eth pair
    /// @dev This function is used to creat eth pair
    /// @param _tokenERC20 Token address
    function createETHPair(address _tokenERC20) external {
        requireActive();
        governance.requireGovernor(msg.sender);
        // check _tokenERC20 is registered or not
        uint16 erc20ID = governance.validateTokenAddress(_tokenERC20);
        // create pair
        address pair = pairManager.createPair(address(0), _tokenERC20);
        require(pair != address(0), "pair is invalid");

        addPairToken(pair);

        registerCreatePair(
            0,
            erc20ID,
            validatePairTokenAddress(pair),
            pair);
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
            if (priorityRequests[id].opType == Operations.OpType.Deposit) {
                bytes memory depositPubdata = _depositsPubdata[currentDepositIdx];
                require(Utils.hashBytesToBytes20(depositPubdata) == priorityRequests[id].hashedPubData, "a");
                ++currentDepositIdx;

                Operations.Deposit memory op = Operations.readDepositPubdata(depositPubdata);
                bytes22 packedBalanceKey = packAddressAndTokenId(op.owner, op.tokenId);
                pendingBalances[packedBalanceKey].balanceToWithdraw += op.amount;
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
        registerDeposit(0, SafeCast.toUint128(msg.value), _zkSyncAddress);
        vault.recordDeposit(0, msg.value);
        payable(address(vault)).transfer(msg.value);
    }

    /// @notice Deposit ETH to Layer 2(can only call from vault) - register deposit
    /// @param _zkSyncAddress The receiver Layer 2 address
    /// @param _amount Deposit amount to register
    function depositETHFromVault(address _zkSyncAddress, uint256 _amount) external {
        require(msg.sender == address(vault), 'dev0');
        requireActive();
        registerDeposit(0, SafeCast.toUint128(_amount), _zkSyncAddress);
        vault.recordDeposit(0, _amount);
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

        // Get token id by its address
        uint16 lpTokenId = tokenIds[address(_token)];
        uint16 tokenId = 0;
        if (lpTokenId == 0) {
            // This means it is not a pair address
            tokenId = governance.validateTokenAddress(address(_token));
            require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused
        } else {
            lpTokenId = validatePairTokenAddress(address(_token));
        }

        if (lpTokenId > 0) {
            // Note: For lp token, main contract always has no money
            pairManager.burn(address(_token), msg.sender, _amount);
            registerDeposit(lpTokenId, _amount, _zkSyncAddress);
        } else {
            // Note: deposit amount must get through balance diff
            uint256 balanceBefore = _token.balanceOf(address(vault));
            require(Utils.transferFromERC20(_token, msg.sender, address(vault), SafeCast.toUint128(_amount)), "c"); // token transfer failed deposit
            uint256 balanceAfter = _token.balanceOf(address(vault));
            uint128 depositAmount = SafeCast.toUint128(balanceAfter.sub(balanceBefore));

            registerDeposit(tokenId, depositAmount, _zkSyncAddress);
            vault.recordDeposit(tokenId, depositAmount);
        }
    }

    function depositERC20FromVault(uint16 _tokenId, address _zkSyncAddress, uint256 _amount) external {
        require(msg.sender == address(vault), 'dev1');
        requireActive();
        require(governance.tokenAddresses(_tokenId) != address(0), 'dev2');
        registerDeposit(_tokenId, SafeCast.toUint128(_amount), _zkSyncAddress);
        vault.recordDeposit(_tokenId, _amount);
    }

    /// @notice Returns amount of tokens that can be withdrawn by `address` from zkSync contract
    /// @param _address Address of the tokens owner
    /// @param _token Address of token, zero address is used for ETH
    function getPendingBalance(address _address, address _token) public view returns (uint128) {
        if (_token != address(0)) {
            uint16 tokenId = getTokenId(_token);
            return pendingBalances[packAddressAndTokenId(_address, tokenId)].balanceToWithdraw;
        } else {
            return pendingBalances[packAddressAndTokenId(_address, 0)].balanceToWithdraw;
        }
    }

    /// @notice  Withdraws tokens from zkSync contract to the owner
    /// @param _owner Address of the tokens owner
    /// @param _token Address of tokens, zero address is used for ETH
    /// @param _amount Amount to withdraw to request.
    ///         NOTE: We will call ERC20.transfer(.., _amount), but if according to internal logic of ERC20 token zkSync contract
    ///         balance will be decreased by value more then _amount we will try to subtract this value from user pending balance
    /// @param _lossBip Amount loss bip when withdraw
    function withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount,
        uint16 _lossBip
    ) external nonReentrant {
        // lp token will not transfer to vault and withdraw by mint new token to owner
        uint16 lpTokenId = tokenIds[_token];
        if (lpTokenId > 0) {
            validatePairTokenAddress(_token);
            registerWithdrawal(lpTokenId, _amount, _owner);
            pairManager.mint(_token, _owner, _amount);
        } else {
            // eth and non lp erc20 token is managed by vault and withdraw from vault
            uint16 tokenId;
            if (_token != address(0)) {
                tokenId = governance.validateTokenAddress(_token);
            }
            bytes22 packedBalanceKey = packAddressAndTokenId(_owner, tokenId);
            uint128 balance = pendingBalances[packedBalanceKey].balanceToWithdraw;
            // We will allow withdrawals of `value` such that:
            // `value` <= user pending balance
            // `value` can be bigger then `_amount` requested if token takes fee from sender in addition to `_amount` requested
            uint256 withdrawnAmount = vault.withdraw(tokenId, _owner, _amount, balance, _lossBip);
            registerWithdrawal(tokenId, SafeCast.toUint128(withdrawnAmount), _owner);
        }
    }

    /// @notice Register full exit request - pack pubdata, add priority request
    /// @param _accountId Numerical id of the account
    /// @param _token Token address, 0 address for ether
    function requestFullExit(uint32 _accountId, address _token) public nonReentrant {
        requireActive();
        require(_accountId <= MAX_ACCOUNT_ID, "e");

        uint16 tokenId;
        if (_token == address(0)) {
            tokenId = 0;
        } else {
            tokenId = getTokenId(_token);
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

    /// @notice Register create pair request - pack pubdata, add priority request and emit CreatePair event
    /// @param _tokenAId Token A by id
    /// @param _tokenBId Token B by id
    /// @param _tokenPairId Pair token by id
    /// @param _pair Pair address
    function registerCreatePair(uint16 _tokenAId, uint16 _tokenBId, uint16 _tokenPairId, address _pair) internal {
        // Priority Queue request
        Operations.CreatePair memory op = Operations.CreatePair({
            accountId: 0,  // unknown at this point
            tokenAId: _tokenAId,
            tokenBId: _tokenBId,
            tokenPairId: _tokenPairId,
            pair: _pair
        });
        bytes memory pubData = Operations.writeCreatePairPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.CreatePair, pubData);

        emit CreatePair(_tokenAId, _tokenBId, _tokenPairId, _pair);
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

    /// @notice Register withdrawal - update user balance and emit OnchainWithdrawal event
    /// @param _token - token by id
    /// @param _amount - token amount
    /// @param _to - address to withdraw to
    function registerWithdrawal(
        uint16 _token,
        uint128 _amount,
        address payable _to
    ) internal {
        bytes22 packedBalanceKey = packAddressAndTokenId(_to, _token);
        uint128 balance = pendingBalances[packedBalanceKey].balanceToWithdraw;
        pendingBalances[packedBalanceKey].balanceToWithdraw = balance.sub(_amount);
        emit Withdrawal(_token, _amount);
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

    function getTokenId(address _token) internal view returns (uint16) {
        uint16 lpTokenId = tokenIds[address(_token)];
        uint16 tokenId = 0;
        if (lpTokenId == 0) {
            // This means it is not a pair address
            tokenId = governance.validateTokenAddress(address(_token));
        } else {
            tokenId = validatePairTokenAddress(address(_token));
        }
        return tokenId;
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
