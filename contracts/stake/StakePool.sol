// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma abicoder v2;

import "../IERC20.sol";
import "../SafeMath.sol";
import "../SafeMathUInt128.sol";
import "../Utils.sol";
import "../Ownable.sol";
import "../Config.sol";
import "../IStrategy.sol";
import "../IZKLinkNFT.sol";
import "../IZKLink.sol";
import "../EnumerableSet.sol";

contract StakePool is Ownable, Config {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;
    using EnumerableSet for EnumerableSet.UintSet;

    /// @dev UINT256.max = 1.15 * 1e77, if reward amount is bigger than 1e65 and power is 1 overflow will happen when update accPerShare
    uint256 constant public MUL_FACTOR = 1e12;

    /// @notice Info of each user
    struct UserInfo {
        uint128 power; // How many final nft mine power the user has provided
        mapping(address => uint256) rewardDebt; // Final nft reward debt of each reward token(include zkl)
        mapping(uint32 => mapping(address => uint256)) pendingRewardDebt; // Pending nft reward debt of each reward token(include zkl)
        mapping(address => uint256) rewardedAmount; // Rewarded amount of each reward token(include zkl)
    }

    /// @notice Info of each pool
    struct PoolInfo {
        IStrategy strategy; // Strategy which put reward tokens to pool
        uint256 bonusStartBlock; // Block number when ZKL mining starts
        uint256 bonusEndBlock; // Block number when bonus ZKL period ends
        uint256 zklPerBlock; // ZKL tokens reward to user per block
        uint128 power; // All final and pending nft mine power
        uint256 lastRewardBlock; // Last block number that ZKLs and strategy reward tokens distribution occurs
        mapping(address => uint256) accPerShare; // Accumulated ZKLs and strategy reward tokens per share, times MUL_FACTOR
        uint256 discardRewardReleaseBlocks; // Discard reward of pending nft must be released slowly to prevent wasting reward hack
        uint256 discardRewardStartBlock; // Discard reward release start block
        uint256 discardRewardEndBlock; // Discard reward release end block
        mapping(address => uint256) discardRewardPerBlock; // Accumulated ZKLs and strategy reward tokens that pending nft power discard
    }

    /// @notice ZKL NFT staked to pool
    IZKLinkNFT public nft;
    /// @notice Zkl token
    IERC20 public zkl;
    /// @notice zkLink contract
    IZKLink public zkLink;
    /// @notice Nft depositor info, nft token id => address
    mapping(uint32 => address) public nftDepositor;
    /// @notice Info of each user that stakes tokens, zkl token id => user address => user info
    mapping(uint16 => mapping(address => UserInfo)) public userInfo;
    // Pending nft set of each user that stakes tokens, zkl token id => user address => final nft set
    mapping(uint16 => mapping(address => EnumerableSet.UintSet)) private userFinalNftSet;
    // Pending nft set of each user that stakes tokens, zkl token id => user address => pending nft set
    mapping(uint16 => mapping(address => EnumerableSet.UintSet)) private userPendingNftSet;
    /// @notice Info of each pool, zkl token id => pool info
    mapping(uint16 => PoolInfo) public poolInfo;
    // All pool ids
    EnumerableSet.UintSet private poolIdSet;

    event Stake(address indexed user, uint32 indexed nftTokenId);
    event UnStake(address indexed user, uint32 indexed nftTokenId);
    event EmergencyUnStake(address indexed user, uint32 indexed nftTokenId);
    event Harvest(uint16 indexed zklTokenId);
    event RevokePendingNft(uint32 indexed nftTokendId);

    constructor(address _nft, address _zkl, address _zkLink, address _masterAddress) Ownable(_masterAddress) {
        nft = IZKLinkNFT(_nft);
        zkl = IERC20(_zkl);
        zkLink = IZKLink(_zkLink);
    }

    /// @notice Get all pool ids
    function poolIds() external view returns (uint16[] memory) {
        uint16[] memory pids = new uint16[](poolIdSet.length());
        for(uint256 i = 0; i < pids.length; i++) {
            pids[i] = uint16(poolIdSet.at(i));
        }
        return pids;
    }

    function poolRewardAccPerShare(uint16 zklTokenId, address rewardToken) external view returns (uint256) {
        return poolInfo[zklTokenId].accPerShare[rewardToken];
    }

    function poolRewardDiscardPerBlock(uint16 zklTokenId, address rewardToken) external view returns (uint256) {
        return poolInfo[zklTokenId].discardRewardPerBlock[rewardToken];
    }

    function userPower(uint16 zklTokenId, address user) external view returns (uint256) {
        return userInfo[zklTokenId][user].power;
    }

    function userRewardDebt(uint16 zklTokenId, address user, address rewardToken) external view returns (uint256) {
        return userInfo[zklTokenId][user].rewardDebt[rewardToken];
    }

    function isUserFinalNft(uint16 zklTokenId, address user, uint32 nftTokenId) public view returns (bool) {
        return userFinalNftSet[zklTokenId][user].contains(nftTokenId);
    }

    function isUserPendingNft(uint16 zklTokenId, address user, uint32 nftTokenId) public view returns (bool) {
        return userPendingNftSet[zklTokenId][user].contains(nftTokenId);
    }

    function isUserNft(uint16 zklTokenId, address user, uint32 nftTokenId) external view returns (bool) {
        return isUserFinalNft(zklTokenId, user, nftTokenId) || isUserPendingNft(zklTokenId, user, nftTokenId);
    }

    /// @notice Get user all staked nft tokens
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param user address of user
    function userNfts(uint16 zklTokenId, address user) public view returns (uint32[] memory) {
        EnumerableSet.UintSet storage finalNftSet = userFinalNftSet[zklTokenId][user];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][user];
        uint256 finalNum = finalNftSet.length();
        uint256 pendingNum = pendingNftSet.length();
        uint32[] memory nftTokenIds = new uint32[](finalNum+pendingNum);
        for(uint256 i = 0; i < finalNum; i++) {
            nftTokenIds[i] = uint32(finalNftSet.at(i));
        }
        for(uint256 i = 0; i < pendingNum; i++) {
            nftTokenIds[i+finalNum] = uint32(pendingNftSet.at(i));
        }
        return nftTokenIds;
    }

    /// @notice Get user all staked token amount
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param user address of user
    function userStakedAmount(uint16 zklTokenId, address user) external view returns (uint256) {
        uint256 amount = 0;
        uint32[] memory nfts = userNfts(zklTokenId, user);
        for(uint256 i = 0; i < nfts.length; i++) {
            uint32 nftId = nfts[i];
            amount = amount.add(nft.tokenLq(nftId).amount);
        }
        return amount;
    }

    function userPendingRewardDebt(uint16 zklTokenId, address user, uint32 nftTokenId, address rewardToken) external view returns (uint256) {
        return userInfo[zklTokenId][user].pendingRewardDebt[nftTokenId][rewardToken];
    }

    /// @notice Get user all rewarded token and amount
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param userAddr address of user
    function userRewarded(uint16 zklTokenId, address userAddr) external view returns (address[] memory, uint256[] memory) {
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][userAddr];
        address[] memory strategyRewardTokens = pool.strategy.rewardTokens();
        address[] memory allTokens = new address[](1+strategyRewardTokens.length);
        allTokens[0] = address(zkl);
        for(uint256 i = 0; i < strategyRewardTokens.length; i++) {
            allTokens[1+i] = strategyRewardTokens[i];
        }
        uint256[] memory allAmounts = new uint256[](allTokens.length);
        for(uint256 i = 0; i < allAmounts.length; i++) {
            allAmounts[i] = user.rewardedAmount[allTokens[i]];
        }
        return (allTokens, allAmounts);
    }

    /// @notice Add a stake pool
    /// @dev can only be called by master
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param strategy stake token to other defi project to earn reward
    /// @param bonusStartBlock zkl token reward to user start block
    /// @param bonusEndBlock zkl token reward to user end block
    /// @param zklPerBlock zkl token reward to user per block
    /// @param discardRewardReleaseBlocks the number of blocks discarded pending nft rewards distribute to user
    function addPool(uint16 zklTokenId,
        IStrategy strategy,
        uint256 bonusStartBlock,
        uint256 bonusEndBlock,
        uint256 zklPerBlock,
        uint256 discardRewardReleaseBlocks) external {
        requireMaster(msg.sender);
        require(poolInfo[zklTokenId].bonusStartBlock == 0, 'StakePool: pool existed');
        require(_blockNumber() < bonusStartBlock && bonusEndBlock > bonusStartBlock, 'StakePool: invalid bonus time interval');
        require(discardRewardReleaseBlocks > 0, 'StakePool: invalid discard reward release blocks');
        _checkStrategy(strategy);

        PoolInfo storage p = poolInfo[zklTokenId];
        p.strategy = strategy;
        p.bonusStartBlock = bonusStartBlock;
        p.bonusEndBlock = bonusEndBlock;
        p.zklPerBlock = zklPerBlock;
        p.discardRewardReleaseBlocks = discardRewardReleaseBlocks;

        poolIdSet.add(zklTokenId);
    }

    /// @notice Update stake pool zkl reward schedule after last schedule finish
    /// @dev can only be called by master
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param bonusStartBlock zkl token reward to user start block
    /// @param bonusEndBlock zkl token reward to user end block
    /// @param zklPerBlock zkl token reward to user per block
    function updatePoolReward(uint16 zklTokenId,
        uint256 bonusStartBlock,
        uint256 bonusEndBlock,
        uint256 zklPerBlock) external {
        requireMaster(msg.sender);
        require(poolInfo[zklTokenId].bonusStartBlock > 0, 'StakePool: pool not existed');
        // only last zkl reward schedule finish and then new schedule can start
        uint256 blockNumber = _blockNumber();
        require(poolInfo[zklTokenId].bonusEndBlock < blockNumber
            && blockNumber < bonusStartBlock
            && bonusEndBlock > bonusStartBlock, 'StakePool: invalid bonus time interval');

        updatePool(zklTokenId);

        PoolInfo storage p = poolInfo[zklTokenId];
        p.bonusStartBlock = bonusStartBlock;
        p.bonusEndBlock = bonusEndBlock;
        p.zklPerBlock = zklPerBlock;
    }

    /// @notice Update stake pool strategy，strategy can be set zero address which means only zkl reward user will receive when harvest
    /// @dev can only be called by master
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param strategy stake token to other defi project to earn reward
    function updatePoolStrategy(uint16 zklTokenId, IStrategy strategy) external {
        requireMaster(msg.sender);
        require(poolInfo[zklTokenId].bonusStartBlock > 0, 'StakePool: pool not existed');
        _checkStrategy(strategy);

        poolInfo[zklTokenId].strategy = strategy;
    }

    /// @notice Update stake pool discardRewardReleaseBlocks
    /// @dev can only be called by master
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param discardRewardReleaseBlocks the number of blocks discarded pending nft rewards distribute to user
    function updatePoolDiscardRewardReleaseBlocks(uint16 zklTokenId, uint256 discardRewardReleaseBlocks) external {
        requireMaster(msg.sender);
        require(poolInfo[zklTokenId].bonusStartBlock > 0, 'StakePool: pool not existed');
        require(discardRewardReleaseBlocks > 0, 'StakePool: invalid discard reward release blocks');

        poolInfo[zklTokenId].discardRewardReleaseBlocks = discardRewardReleaseBlocks;
    }

    /// @notice Pick pool left reward token after all user exit
    /// @dev can only be called by master
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param rewardToken reward token address
    /// @param to reward token receiver
    /// @param amount reward token pick amount
    function pickPool(uint16 zklTokenId, IERC20 rewardToken, address to, uint256 amount) external {
        requireMaster(msg.sender);
        require(_blockNumber() > poolInfo[zklTokenId].bonusEndBlock, 'StakePool: pool reward not end');
        require(poolInfo[zklTokenId].power == 0, 'StakePool: user exist in pool');

        _safeRewardTransfer(rewardToken, to, amount);
    }

    /// @notice Stake ZKLinkNFT to pool for reward allocation
    /// @param nftTokenId token id of ZKLinkNFT
    function stake(uint32 nftTokenId) public {
        IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
        // only ADD_PENDING and FINAL nft can be staked
        require(lq.status == IZKLinkNFT.LqStatus.ADD_PENDING ||
            lq.status == IZKLinkNFT.LqStatus.FINAL, 'StakePool: invalid nft status');
        nft.transferFrom(msg.sender, address(this), nftTokenId);
        nftDepositor[nftTokenId] = msg.sender;

        uint16 zklTokenId = lq.tokenId;
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage finalNftSet = userFinalNftSet[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][msg.sender];
        updatePool(zklTokenId);

        if (user.power > 0) {
            _transferRewards(pool, user);
        }

        // add nft power to pool total power whether nft status is final or not
        pool.power = pool.power.add(lq.amount);
        if (lq.status == IZKLinkNFT.LqStatus.FINAL) {
            // add nft power to user power only if nft status is final
            user.power = user.power.add(lq.amount);
            finalNftSet.add(nftTokenId);
        } else {
            // record pending nft reward debt
            pendingNftSet.add(nftTokenId);
            _updatePendingAccShareDebts(pool, user, nftTokenId, lq.amount);
        }
        _updateRewardDebts(pool, user);

        emit Stake(msg.sender, nftTokenId);
    }

    /// @notice Add liquidity to zkLink and then stake ZKLinkNFT to pool for reward allocation
    /// @param token Token added
    /// @param amount Amount of token
    /// @param pair L2 cross chain pair address
    /// @param minLpAmount L2 lp token amount min received
    function addLiquidityAndStake(IERC20 token, uint104 amount, address pair, uint104 minLpAmount) external {
        // token transfer to pool firstly and then transfer from pool to zkLink
        token.transferFrom(msg.sender, address(this), amount);
        token.approve(address(zkLink), amount);
        uint32 nftTokenId = zkLink.addLiquidity(msg.sender, token, amount, pair, minLpAmount);
        // user should have approved all nft to pool
        stake(nftTokenId);
    }

    /// @notice UnStake ZklNft tokens from pool
    /// @param nftTokenId token id of ZKLinkNFT
    function unStake(uint32 nftTokenId) public {
        require(nftDepositor[nftTokenId] == msg.sender, 'StakePool: not depositor');

        // nft token status may be ADD_PENDING, FINAL or ADD_FAIL
        IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
        uint16 zklTokenId = lq.tokenId;
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage finalNftSet = userFinalNftSet[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][msg.sender];
        updatePool(zklTokenId);

        if (user.power > 0) {
            _transferRewards(pool, user);
        }
        // remove nft power from pool total power whether nft status is final or not
        pool.power = pool.power.sub(lq.amount);
        if (pendingNftSet.contains(nftTokenId)) {
            if (lq.status == IZKLinkNFT.LqStatus.FINAL) {
                // transfer pending reward to user
                _transferPendingRewards(pool, user, nftTokenId, lq.amount);
            } else {
                // discard this pending nft acc reward and release slowly to final nft depositors
                _updateDiscardReward(pool, user, nftTokenId, lq.amount);
            }
            pendingNftSet.remove(nftTokenId);
        } else {
            // remove nft power from user power only if nft status is final when staked
            user.power = user.power.sub(lq.amount);
            finalNftSet.remove(nftTokenId);
        }
        _updateRewardDebts(pool, user);
        _transferNftToDepositor(nftTokenId, msg.sender);
        emit UnStake(msg.sender, nftTokenId);
    }

    /// @notice UnStake ZklNft tokens from pool and then remove liquidity from zkLink
    /// @param nftTokenId token id of ZKLinkNFT
    /// @param minAmount Token amount min received
    function unStakeAndRemoveLiquidity(uint32 nftTokenId, uint104 minAmount) external {
        unStake(nftTokenId);
        // user should have approved all nft to pool
        nft.transferFrom(msg.sender, address(this), nftTokenId);
        zkLink.removeLiquidity(msg.sender, nftTokenId, minAmount);
    }

    /// @notice Emergency unStake ZklNft tokens from pool without caring about rewards
    /// @param nftTokenId token id of ZKLinkNFT
    function emergencyUnStake(uint32 nftTokenId) external {
        require(nftDepositor[nftTokenId] == msg.sender, 'StakePool: not depositor');

        // only FINAL nft can emergency unStake
        IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
        require(lq.status == IZKLinkNFT.LqStatus.FINAL, 'StakePool: only FINAL nft can emergency unStake');

        uint16 zklTokenId = lq.tokenId;
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage finalNftSet = userFinalNftSet[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][msg.sender];

        // remove nft power from pool total power whether nft status is final or not
        pool.power = pool.power.sub(lq.amount);
        if (pendingNftSet.contains(nftTokenId)) {
            pendingNftSet.remove(nftTokenId);
        } else {
            // remove nft power from user power only if nft status is final when staked
            user.power = user.power.sub(lq.amount);
            finalNftSet.remove(nftTokenId);
        }
        _transferNftToDepositor(nftTokenId, msg.sender);
        emit EmergencyUnStake(msg.sender, nftTokenId);
    }

    /// @notice Any one can revoke ADD_FAIL nft from pool to avoid wasting of reward
    /// @param nftTokenId token id of ZKLinkNFT
    function revokePendingNft(uint32 nftTokenId) external {
        address depositor = nftDepositor[nftTokenId];
        require(depositor != address(0), 'StakePool: nft not staked');

        // nft token status must be ADD_FAIL
        IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
        require(lq.status == IZKLinkNFT.LqStatus.ADD_FAIL, 'StakePool: require nft ADD_FAIL');

        uint16 zklTokenId = lq.tokenId;
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][depositor];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][depositor];
        // no need to update pool
        // remove nft power from pool total power
        pool.power = pool.power.sub(lq.amount);
        // discard this pending nft acc reward and release slowly to final nft depositors
        _updateDiscardReward(pool, user, nftTokenId, lq.amount);
        pendingNftSet.remove(nftTokenId);
        _transferNftToDepositor(nftTokenId, depositor);

        emit RevokePendingNft(nftTokenId);
    }

    /// @notice Get pending reward of user
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param rewardToken reward token address
    /// @param account user address
    function pendingReward(uint16 zklTokenId, address rewardToken, address account) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][account];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][account];
        uint256 accPerShare = pool.accPerShare[rewardToken];
        // acc per share should update to current block
        if (pool.power > 0) {
            uint256 shareIncrement = _calRewardShareIncrement(pool, rewardToken);
            accPerShare = accPerShare.add(shareIncrement);
        }
        uint256 pending = _calPending(user.power, accPerShare, user.rewardDebt[rewardToken]);

        uint256 pendingNftLength = pendingNftSet.length();
        for(uint256 i = 0; i < pendingNftLength; i++) {
            uint32 nftTokenId = uint32(pendingNftSet.at(i));
            IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
            // only final status nft will transfer pending acc reward to user
            if (lq.status == IZKLinkNFT.LqStatus.FINAL) {
                uint256 debt = user.pendingRewardDebt[nftTokenId][rewardToken];
                uint256 nftPending = _calPending(lq.amount, accPerShare, debt);
                pending = pending.add(nftPending);
            }
        }
        return pending;
    }

    /// @notice Get all pending reward of user
    /// @param zklTokenId token id managed by Governance of ZkLink
    /// @param account user address
    function pendingRewards(uint16 zklTokenId, address account) external view returns (address[] memory, uint256[] memory) {
        uint256 rewardTokenLen = 1;
        address[] memory harvestRewardTokens;
        PoolInfo storage pool = poolInfo[zklTokenId];
        if (address(pool.strategy) != address(0)) {
            harvestRewardTokens = pool.strategy.rewardTokens();
            rewardTokenLen += harvestRewardTokens.length;
        }
        address[] memory rewardTokens = new address[](rewardTokenLen);
        uint256[] memory rewardAmounts = new uint256[](rewardTokenLen);
        rewardTokens[0] = address(zkl);
        rewardAmounts[0] = pendingReward(zklTokenId, rewardTokens[0], account);
        for (uint256 i = 1; i < rewardTokenLen; i++) {
            rewardTokens[i] = harvestRewardTokens[i-1];
            rewardAmounts[i] = pendingReward(zklTokenId, rewardTokens[i], account);
        }
        return (rewardTokens, rewardAmounts);
    }

    /// @notice Harvest reward tokens from pool
    /// @param zklTokenId token id managed by Governance of ZkLink
    function harvest(uint16 zklTokenId) external {
        PoolInfo storage pool = poolInfo[zklTokenId];
        UserInfo storage user = userInfo[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage finalNftSet = userFinalNftSet[zklTokenId][msg.sender];
        EnumerableSet.UintSet storage pendingNftSet = userPendingNftSet[zklTokenId][msg.sender];
        updatePool(zklTokenId);

        if (user.power > 0) {
            _transferRewards(pool, user);
        }

        uint256 pendingNftLength = pendingNftSet.length();
        // NOTE: check from the last item of pendingNftSet to ensure correct removal
        // NOTE: pendingNftLength may be zero so pendingNftLength - 1 will be uint.MAX and
        // when i decrease to zero the next i-- will be uint.MAX
        for(uint256 i = pendingNftLength - 1; i < pendingNftLength; i--) {
            uint32 nftTokenId = uint32(pendingNftSet.at(i));
            IZKLinkNFT.Lq memory lq = nft.tokenLq(nftTokenId);
            if (lq.status == IZKLinkNFT.LqStatus.FINAL) {
                // transfer pending reward to user
                _transferPendingRewards(pool, user, nftTokenId, lq.amount);
                user.power = user.power.add(lq.amount);
                finalNftSet.add(nftTokenId);
                pendingNftSet.remove(nftTokenId);
            }
        }

        _updateRewardDebts(pool, user);
        emit Harvest(zklTokenId);
    }

    /// @notice Update reward variables of the given pool to be up-to-date
    /// @param zklTokenId token id managed by Governance of ZkLink
    function updatePool(uint16 zklTokenId) public {
        PoolInfo storage pool = poolInfo[zklTokenId];
        uint256 lastRewardBlock = pool.lastRewardBlock;
        uint256 blockNumber = _blockNumber();
        // only allocate once at the same block
        if (blockNumber <= lastRewardBlock) {
            return;
        }
        if (pool.power == 0) {
            pool.lastRewardBlock = blockNumber;
            return;
        }
        // the block in (bonusStartBlock, bonusEndBlock] will be allocated zkl
        uint256 zklRewardBlocks = _calRewardBlocks(blockNumber, pool.bonusStartBlock, pool.bonusEndBlock, pool.lastRewardBlock);
        // the block in (discardRewardStartBlock, discardRewardEndBlock] will be allocated discard reward
        uint256 dsdRewardBlocks = _calRewardBlocks(blockNumber, pool.discardRewardStartBlock, pool.discardRewardEndBlock, pool.lastRewardBlock);
        uint256 zklRewardAmount = zklRewardBlocks.mul(pool.zklPerBlock);
        uint256 zklShare = _calRewardShare(pool, address(zkl), zklRewardAmount, dsdRewardBlocks);
        pool.accPerShare[address(zkl)] = pool.accPerShare[address(zkl)].add(zklShare);

        if (address(pool.strategy) != address(0)) {
            // strategy harvest and reward token will transfer to pool
            uint256[] memory rewardAmounts = pool.strategy.harvest();
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                uint256 rewardAmount = rewardAmounts[i];
                uint256 rewardShare = _calRewardShare(pool, rewardToken, rewardAmount, dsdRewardBlocks);
                pool.accPerShare[rewardToken] = pool.accPerShare[rewardToken].add(rewardShare);
            }
        }
        // update lastRewardBlock to current block number
        pool.lastRewardBlock = blockNumber;
    }

    function _checkStrategy(IStrategy strategy) internal view {
        if (address(strategy) != address(0)) {
            address[] memory rewardTokens = strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                require(rewardTokens[i] != address(zkl), 'StakePool: strategy reward token');
            }
        }
    }

    function _transferRewards(PoolInfo storage pool, UserInfo storage user) internal {
        uint256 pending = _calPending(user.power, pool.accPerShare[address(zkl)], user.rewardDebt[address(zkl)]);
        user.rewardedAmount[address(zkl)] = user.rewardedAmount[address(zkl)].add(pending);
        _safeRewardTransfer(zkl, msg.sender, pending);
        if (address(pool.strategy) != address(0)) {
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                pending = _calPending(user.power, pool.accPerShare[rewardToken], user.rewardDebt[rewardToken]);
                user.rewardedAmount[rewardToken] = user.rewardedAmount[rewardToken].add(pending);
                _safeRewardTransfer(IERC20(rewardToken), msg.sender, pending);
            }
        }
    }

    function _transferPendingRewards(PoolInfo storage pool, UserInfo storage user, uint32 nftTokenId, uint128 nftPower) internal {
         _transferPendingReward(pool, user, nftTokenId, nftPower, address(zkl));
        if (address(pool.strategy) != address(0)) {
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                _transferPendingReward(pool, user, nftTokenId, nftPower, rewardToken);
            }
        }
    }

    function _transferPendingReward(PoolInfo storage pool, UserInfo storage user, uint32 nftTokenId, uint128 nftPower, address rewardToken) internal {
        uint256 pending = _calPending(nftPower, pool.accPerShare[rewardToken], user.pendingRewardDebt[nftTokenId][rewardToken]);
        user.rewardedAmount[rewardToken] = user.rewardedAmount[rewardToken].add(pending);
        _safeRewardTransfer(IERC20(rewardToken), msg.sender, pending);
        delete user.pendingRewardDebt[nftTokenId][rewardToken];
    }

    /// @dev Safe reward transfer function, just in case if rounding error causes pool to not have enough Rewards
    function _safeRewardTransfer(IERC20 rewardToken, address to, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        uint256 rewardBal = rewardToken.balanceOf(address(this));
        amount = amount > rewardBal ? rewardBal : amount;
        require(Utils.sendERC20(rewardToken, to, amount), 'StakePool: sendERC20');
    }

    function _updateRewardDebts(PoolInfo storage pool, UserInfo storage user) internal {
        user.rewardDebt[address(zkl)] = _calRewardDebt(user.power, pool.accPerShare[address(zkl)]);
        if (address(pool.strategy) != address(0)) {
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                user.rewardDebt[rewardToken] = _calRewardDebt(user.power, pool.accPerShare[rewardToken]);
            }
        }
    }

    function _updatePendingAccShareDebts(PoolInfo storage pool, UserInfo storage user, uint32 nftTokenId, uint128 nftPower) internal {
        user.pendingRewardDebt[nftTokenId][address(zkl)] = _calRewardDebt(nftPower, pool.accPerShare[address(zkl)]);
        if (address(pool.strategy) != address(0)) {
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                user.pendingRewardDebt[nftTokenId][rewardToken] = _calRewardDebt(nftPower, pool.accPerShare[rewardToken]);
            }
        }
    }

    function _updateDiscardReward(PoolInfo storage pool, UserInfo storage user, uint32 nftTokenId, uint128 nftPower) internal {
        _updateDiscardRewardOfToken(pool, user, nftTokenId, nftPower, address(zkl));
        if (address(pool.strategy) != address(0)) {
            address[] memory rewardTokens = pool.strategy.rewardTokens();
            for(uint256 i = 0; i < rewardTokens.length; i++) {
                address rewardToken = rewardTokens[i];
                _updateDiscardRewardOfToken(pool, user, nftTokenId, nftPower, rewardToken);
            }
        }
        pool.discardRewardStartBlock = pool.lastRewardBlock;
        pool.discardRewardEndBlock = pool.lastRewardBlock.add(pool.discardRewardReleaseBlocks);
    }

    function _updateDiscardRewardOfToken(PoolInfo storage pool, UserInfo storage user, uint32 nftTokenId, uint128 nftPower, address rewardToken) internal {
        // if there are any discard reward unreleased accumulate it with new discard reward
        uint256 unReleasedReward = 0;
        if (pool.discardRewardEndBlock > pool.lastRewardBlock) {
            unReleasedReward = pool.discardRewardPerBlock[rewardToken].mul(pool.discardRewardEndBlock - pool.lastRewardBlock);
        }
        uint256 discardReward = _calPending(nftPower, pool.accPerShare[rewardToken], user.pendingRewardDebt[nftTokenId][rewardToken]);
        pool.discardRewardPerBlock[rewardToken] = unReleasedReward.add(discardReward).div(pool.discardRewardReleaseBlocks);
        delete user.pendingRewardDebt[nftTokenId][rewardToken];
    }

    function _transferNftToDepositor(uint32 nftTokenId, address depositor) internal {
        nft.transferFrom(address(this), depositor, nftTokenId);
        delete nftDepositor[nftTokenId];
    }

    function _calRewardShareIncrement(PoolInfo storage pool, address rewardToken) internal view returns (uint256) {
        uint256 blockNumber = _blockNumber();
        uint256 accRewardAmount = 0;
        if (rewardToken == address(zkl)) {
            // the block in (bonusStartBlock, bonusEndBlock] will be allocated zkl
            uint256 zklRewardBlocks = _calRewardBlocks(blockNumber, pool.bonusStartBlock, pool.bonusEndBlock, pool.lastRewardBlock);
            accRewardAmount = zklRewardBlocks.mul(pool.zklPerBlock);
        }
        // the block in (discardRewardStartBlock, discardRewardEndBlock] will be allocated discard reward
        uint256 dsdRewardBlocks = _calRewardBlocks(blockNumber, pool.discardRewardStartBlock, pool.discardRewardEndBlock, pool.lastRewardBlock);
        return _calRewardShare(pool, rewardToken, accRewardAmount, dsdRewardBlocks);
    }

    function _calRewardBlocks(uint256 currentBlock, uint256 startBlock, uint256 endBlock, uint256 lastRewardBlock) internal pure returns (uint256) {
        if (currentBlock <= startBlock || lastRewardBlock >= endBlock) {
            return 0;
        }
        uint256 rewardStart = lastRewardBlock < startBlock ? startBlock : lastRewardBlock;
        uint256 rewardEnd = currentBlock > endBlock ? endBlock : currentBlock;
        return rewardEnd.sub(rewardStart);
    }

    function _calRewardShare(PoolInfo storage pool, address rewardToken, uint256 rewardAmount, uint256 dsdRewardBlocks) internal view returns (uint256) {
        uint256 dsdAmount = dsdRewardBlocks.mul(pool.discardRewardPerBlock[rewardToken]);
        uint256 totalAmount = rewardAmount.add(dsdAmount);
        // pool power will never be zero at this point
        return totalAmount.mul(MUL_FACTOR).div(pool.power);
    }

    function _calRewardDebt(uint128 power, uint256 poolAccPerShare) internal pure returns (uint256) {
        return uint256(power).mul(poolAccPerShare).div(MUL_FACTOR);
    }

    function _calPending(uint128 power, uint256 poolAccPerShare, uint256 rewardDebt) internal pure returns (uint256) {
        return uint256(power).mul(poolAccPerShare).div(MUL_FACTOR).sub(rewardDebt);
    }

    function _blockNumber() virtual internal view returns (uint256) {
        return block.number;
    }
}
