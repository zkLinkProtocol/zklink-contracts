// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/SafeMath.sol";
import "./zksync/SafeMathUInt128.sol";
import "./zksync/SafeCast.sol";
import "./zksync/Utils.sol";

import "./zksync/Operations.sol";

import "./zksync/UpgradeableMaster.sol";
import "./ZkLinkBase.sol";
import "./IZkLink.sol";

/// @title ZkLink main contract part 1: deposit, withdraw, add or remove liquidity, swap
/// @author zk.link
contract ZkLink is UpgradeableMaster, ZkLinkBase, IZkLink {
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

    /// @notice ZkLink contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    /// @dev _governanceAddress The address of Governance contract
    /// @dev _verifierAddress The address of Verifier contract
    /// @dev _zkLinkBlock The address of ZkLinkBlock contract
    /// @dev _zkLinkExit The address of ZkLinkExit contract
    /// @dev _pairManagerAddress The address of UniswapV2Factory contract
    /// @dev _vaultAddress The address of Vault contract
    /// @dev _genesisStateHash Genesis blocks (first block) state tree root hash
    function initialize(bytes calldata initializationParameters) external {
        initializeReentrancyGuard();

        (address _governanceAddress, address _verifierAddress, address payable _vaultAddress, address _zkLinkBlock, address _zkLinkExit, bytes32 _genesisStateHash) =
            abi.decode(initializationParameters, (address, address, address, address, address, bytes32));

        verifier = Verifier(_verifierAddress);
        governance = Governance(_governanceAddress);
        vault = IVault(_vaultAddress);
        zkLinkBlock = _zkLinkBlock;
        zkLinkExit = _zkLinkExit;

        // We need initial state hash because it is used in the commitment of the next block
        StoredBlockInfo memory storedBlockZero =
            StoredBlockInfo(0, 0, EMPTY_STRING_KECCAK, 0, _genesisStateHash, bytes32(0));

        storedBlockHashes[0] = hashStoredBlockInfo(storedBlockZero);
    }

    /// @notice ZkLink contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    function upgrade(bytes calldata upgradeParameters) external nonReentrant {
        (address _zkLinkBlock, address _zkLinkExit) = abi.decode(upgradeParameters, (address, address));
        zkLinkBlock = _zkLinkBlock;
        zkLinkExit = _zkLinkExit;
    }

    /// @notice Deposit ETH to Layer 2 - transfer ether from user into contract, validate it, register deposit
    /// @param _zkLinkAddress The receiver Layer 2 address
    function depositETH(address _zkLinkAddress) external payable {
        requireActive();
        require(msg.value > 0, 'ZkLink: deposit amount');

        (bool success, ) = payable(address(vault)).call{value: msg.value}("");
        require(success, "ZkLink: eth transfer failed");
        vault.recordDeposit(0);
        registerDeposit(0, SafeCast.toUint128(msg.value), _zkLinkAddress);
    }

    /// @notice Deposit ERC20 token to Layer 2 - transfer ERC20 tokens from user into contract, validate it, register deposit
    /// @param _token Token address
    /// @param _amount Token amount
    /// @param _zkLinkAddress Receiver Layer 2 address
    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        address _zkLinkAddress
    ) external nonReentrant {
        requireActive();
        require(_amount > 0, 'ZkLink: deposit amount');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
        registerDeposit(tokenId, _amount, _zkLinkAddress);
    }

    /// @notice Swap ETH from this chain to another token(this chain or another chain) - transfer ETH from user into contract, validate it, register swap
    /// @param _zkLinkAddress Receiver Layer 2 address if swap failed
    /// @param _amountOutMin Minimum receive amount of to token when no fast withdraw
    /// @param _toChainId Chain id of to token
    /// @param _toTokenId Swap token to
    /// @param _to To token received address
    /// @param _nonce Used to produce unique accept info
    /// @param _pair L2 cross chain pair address
    /// @param _acceptTokenId Accept token user really want to receive
    /// @param _acceptAmountOutMin Accept token min amount user really want to receive
    function swapExactETHForTokens(address _zkLinkAddress,
        uint104 _amountOutMin,
        uint8 _toChainId,
        uint16 _toTokenId,
        address _to,
        uint32 _nonce,
        address _pair,
        uint16 _acceptTokenId,
        uint128 _acceptAmountOutMin) external payable {
        requireActive();
        require(msg.value > 0, 'ZkLink: amountIn');
        require(_acceptAmountOutMin> 0, 'ZkLink: acceptAmountOutMin');
        if (_toChainId == CHAIN_ID) {
            require(_toTokenId != 0, 'ZkLink: can not swap to the same token');
        }

        (bool success, ) = payable(address(vault)).call{value: msg.value}("");
        require(success, "ZkLink: eth transfer failed");
        vault.recordDeposit(0);
        registerQuickSwap(_zkLinkAddress, SafeCast.toUint128(msg.value), _amountOutMin, 0, _toChainId, _toTokenId, _to, _nonce, _pair, _acceptTokenId, _acceptAmountOutMin);
    }

    /// @notice Swap ERC20 token from this chain to another token(this chain or another chain) - transfer ERC20 tokens from user into contract, validate it, register swap
    /// @param _zkLinkAddress Receiver Layer 2 address if swap failed
    /// @param _amountIn Swap amount of from token
    /// @param _amountOutMin Minimum swap out amount of to token
    /// @param _fromToken Swap token from
    /// @param _toChainId Chain id of to token
    /// @param _toTokenId Swap token to
    /// @param _to To token received address
    /// @param _nonce Used to produce unique accept info
    /// @param _pair L2 cross chain pair address
    /// @param _acceptTokenId Accept token user really want to receive
    /// @param _acceptAmountOutMin Accept token min amount user really want to receive
    function swapExactTokensForTokens(address _zkLinkAddress,
        uint104 _amountIn,
        uint104 _amountOutMin,
        IERC20 _fromToken,
        uint8 _toChainId,
        uint16 _toTokenId,
        address _to,
        uint32 _nonce,
        address _pair,
        uint16 _acceptTokenId,
        uint128 _acceptAmountOutMin) external {
        requireActive();
        require(_amountIn > 0, 'ZkLink: amountIn');
        require(_acceptAmountOutMin> 0, 'ZkLink: acceptAmountOutMin');

        // Get token id by its address
        uint16 fromTokenId = governance.validateTokenAddress(address(_fromToken));
        require(!governance.pausedTokens(fromTokenId), "b"); // token deposits are paused
        if (_toChainId == CHAIN_ID) {
            require(_toTokenId != fromTokenId, 'ZkLink: can not swap to the same token');
        }

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_fromToken, msg.sender, address(vault), _amountIn), "c"); // token transfer failed deposit
        vault.recordDeposit(fromTokenId);
        registerQuickSwap(_zkLinkAddress, _amountIn, _amountOutMin, fromTokenId, _toChainId, _toTokenId, _to, _nonce, _pair, _acceptTokenId, _acceptAmountOutMin);
    }

    /// @notice Mapping ERC20 from this chain to another chain - transfer ERC20 tokens from user into contract, validate it, register mapping
    /// @param _zkLinkAddress Receiver Layer 2 address if mapping failed
    /// @param _to Address in to chain to receive token
    /// @param _amount Mapping amount of token
    /// @param _token Mapping token
    /// @param _toChainId Chain id of to token
    /// @param _nonce Used to produce unique accept info
    /// @param _withdrawFee Accept withdraw fee, 100 means 1%
    function mappingToken(address _zkLinkAddress, address _to, uint104 _amount, IERC20 _token, uint8 _toChainId, uint32 _nonce, uint16 _withdrawFee) external {
        requireActive();
        require(_amount > 0, 'ZkLink: amount');
        require(_toChainId != CHAIN_ID, 'ZkLink: toChainId');
        require(_withdrawFee < MAX_WITHDRAW_FEE, 'ZkLink: withdrawFee');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused
        require(governance.mappingTokens(tokenId), 'ZkLink: not mapping token');

        // token must not be taken fees when transfer
        // just transfer to vault, do not call vault.recordDeposit
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        registerTokenMapping(_zkLinkAddress, _to, _amount, tokenId, _toChainId, _nonce, _withdrawFee);
    }

    /// @notice Add token to l2 cross chain pair
    /// @param _zkLinkAddress Receiver Layer 2 address if add liquidity failed
    /// @param _token Token added
    /// @param _amount Amount of token
    /// @param _pair L2 cross chain pair address
    /// @param _minLpAmount L2 lp token amount min received
    function addLiquidity(address _zkLinkAddress, IERC20 _token, uint104 _amount, address _pair, uint104 _minLpAmount) override external returns (uint32) {
        requireActive();
        require(_amount > 0, 'ZkLink: amount');

        // Get token id by its address
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(!governance.pausedTokens(tokenId), "b"); // token deposits are paused
        // nft must exist
        require(address(governance.nft()) != address(0), 'ZkLink: nft not exist');

        // token must not be taken fees when transfer
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), _amount), "c"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
        // mint a pending nft to user
        uint32 nftTokenId = governance.nft().addLq(_zkLinkAddress, tokenId, _amount, _pair);
        registerAddLiquidity(_zkLinkAddress, tokenId, _amount, _pair, _minLpAmount, nftTokenId);
        return nftTokenId;
    }

    /// @notice Remove liquidity from l1 and get token back from l2 cross chain pair
    /// @param _zkLinkAddress Receiver Layer 2 address if remove liquidity success
    /// @param _nftTokenId Nft token that contains info about the liquidity
    /// @param _minAmount Token amount min received
    function removeLiquidity(address _zkLinkAddress, uint32 _nftTokenId, uint104 _minAmount) override external {
        requireActive();
        // nft must exist
        require(address(governance.nft()) != address(0), 'ZkLink: nft not exist');
        require(governance.nft().ownerOf(_nftTokenId) == msg.sender, 'ZkLink: not nft owner');
        // update nft status
        governance.nft().removeLq(_nftTokenId);
        // register request
        IZkLinkNFT.Lq memory lq = governance.nft().tokenLq(_nftTokenId);
        registerRemoveLiquidity(_zkLinkAddress, lq.tokenId, _minAmount, lq.pair, lq.lpTokenAmount, _nftTokenId);
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
        uint16 _fromTokenId,
        uint8 _toChainId,
        uint16 _toTokenId,
        address _to,
        uint32 _nonce,
        address _pair,
        uint16 _acceptTokenId,
        uint128 _acceptAmountOutMin
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
                amountOut: 0, // unknown at this point
                nonce: _nonce,
                pair: _pair,
                acceptTokenId: _acceptTokenId,
                acceptAmountOutMin: _acceptAmountOutMin
            });
        bytes memory pubData = Operations.writeQuickSwapPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.QuickSwap, pubData);
        emit QuickSwap(_owner, _amountIn, _amountOutMin, _fromTokenId, _toChainId, _toTokenId, _to, _nonce, _pair, _acceptTokenId, _acceptAmountOutMin);
    }

    /// @notice Register mapping request - pack pubdata, add priority request and emit OnchainMapping event
    function registerTokenMapping(
        address _owner,
        address _to,
        uint128 _amount,
        uint16 _tokenId,
        uint8 _toChainId,
        uint32 _nonce,
        uint16 _withdrawFee
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
                fee: 0, // unknown at this point
                nonce: _nonce,
                withdrawFee: _withdrawFee
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
                minLpAmount: _minLpAmount,
                lpAmount: 0,
                nftTokenId: _nftTokenId
            }
        );
        bytes memory pubData = Operations.writeL1AddLQPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.L1AddLQ, pubData);
        emit AddLiquidity(_pair, _tokenId, _amount);
    }

    /// @notice Register remove liquidity request - pack pubdata, add priority request and emit OnchainAddLiquidity event
    function registerRemoveLiquidity(
        address _owner,
        uint16 _tokenId,
        uint128 _minAmount,
        address _pair,
        uint128 _lpAmount,
        uint32 _nftTokenId
    ) internal {
        // Priority Queue request
        Operations.L1RemoveLQ memory op =
        Operations.L1RemoveLQ({
            owner: _owner,
            chainId: CHAIN_ID,
            tokenId: _tokenId,
            minAmount: _minAmount,
            amount: 0,
            pair: _pair,
            lpAmount: _lpAmount,
            nftTokenId: _nftTokenId
        }
        );
        bytes memory pubData = Operations.writeL1RemoveLQPubdataForPriorityQueue(op);
        addPriorityRequest(Operations.OpType.L1RemoveLQ, pubData);
        emit RemoveLiquidity(_pair, _tokenId, _lpAmount);
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

    /// @notice Will run when no functions matches call data
    fallback() external payable {
        _fallback(zkLinkBlock);
    }

    /// @notice Same as fallback but called when calldata is empty
    receive() external payable {
        _fallback(zkLinkBlock);
    }
}
