const hardhat = require('hardhat');
const { expect } = require('chai');

describe('StakePool unit tests', function () {
    let nft,zkl,pool,wallet,networkGovernor,zkLink,vault,alice,bob,pair;
    let tokenA, tokenB, tokenC;
    let strategy;
    beforeEach(async () => {
        [wallet,networkGovernor,vault,alice,bob,pair] = await hardhat.ethers.getSigners();
        // token
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        tokenA = await erc20Factory.deploy(10000);
        tokenB = await erc20Factory.deploy(10000);
        tokenC = await erc20Factory.deploy(10000);
        // governance
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [networkGovernor.address])
        );
        await governance.connect(networkGovernor).addToken(tokenA.address); // tokenId = 1
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // Vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        vault = await vaultFactory.deploy();
        await vault.initialize(hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governance.address]));
        // ZkSync
        const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
        zkLink = await zkSyncFactory.deploy();
        // ZkSyncCommitBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkLinkBlock');
        const zkSyncBlockRaw = await zkSyncBlockFactory.deploy();
        // ZkSyncExit
        const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkLinkExit');
        const zkSyncExitRaw = await zkSyncExitFactory.deploy();
        await zkLink.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                [governance.address, verifier.address, vault.address, zkSyncBlockRaw.address, zkSyncExitRaw.address, hardhat.ethers.utils.arrayify("0x1b06adabb8022e89da0ddb78157da7c57a5b7356ccc9ad2f51475a4bb13970c6")])
        );
        await vault.setZkLinkAddress(zkLink.address);
        // nft
        const nftFactory = await hardhat.ethers.getContractFactory('ZkLinkNFT');
        nft = await nftFactory.deploy(hardhat.ethers.constants.AddressZero);
        await nft.transferOwnership(zkLink.address);
        await governance.connect(networkGovernor).changeNft(nft.address);
        // zkl
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        zkl = await zklFactory.deploy('ZKLINK','ZKL',1000000000,hardhat.ethers.constants.AddressZero,networkGovernor.address,true);
        // stake pool
        const poolFactory = await hardhat.ethers.getContractFactory('StakePoolTest');
        pool = await poolFactory.deploy(nft.address,zkl.address,zkLink.address,networkGovernor.address);
        // strategy
        const strategyFactory = await hardhat.ethers.getContractFactory('SimpleStrategy');
        strategy = await strategyFactory.deploy(vault.address,1,tokenA.address,pool.address,[tokenB.address,tokenC.address]);
        await strategy.setHarvestAmounts([100,300]);
    });

    it('pool manage can only call by master', async () => {
        await expect(pool.connect(alice).addPool(1, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 1)).to.be.revertedWith('1c');
        await expect(pool.connect(alice).updatePoolReward(1, 100000, 200000, 100)).to.be.revertedWith('1c');
        await expect(pool.connect(alice).updatePoolStrategy(1, hardhat.ethers.constants.AddressZero)).to.be.revertedWith('1c');
        await expect(pool.connect(alice).updatePoolDiscardRewardReleaseBlocks(1, 1)).to.be.revertedWith('1c');
        await expect(pool.connect(alice).pickPool(1, zkl.address, alice.address, 1)).to.be.revertedWith('1c');
    });

    it('update pool should success', async () => {
        const zklTokenId = 1;
        // add pool, start block should larger than current block number
        await pool.setBlockNumber(99);
        await pool.connect(networkGovernor).addPool(zklTokenId, strategy.address, 100, 200, 100, 10);
        // when no power pool just update lastRewardBlock
        await pool.updatePool(zklTokenId);
        let poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.lastRewardBlock).to.eq(99);
        // pool should set correct accPerShare when has power and reward
        await pool.setPoolPower(zklTokenId, 50);
        // (110,120] has 10 block rewards
        await pool.setBlockNumber(120);
        await pool.setPoolLastRewardBlock(zklTokenId, 110);
        await pool.updatePool(zklTokenId);
        // zkl: 10 * 100 * 1e12 / 50 = 2 * 1e13
        expect(await pool.poolRewardAccPerShare(zklTokenId, zkl.address)).to.eq(hardhat.ethers.utils.parseUnits('2', 13));
        // tokenB: 100 * 1e12 / 50 = 2 * 1e12
        expect(await pool.poolRewardAccPerShare(zklTokenId, tokenB.address)).to.eq(hardhat.ethers.utils.parseUnits('2', 12));
        // tokenC: 300 * 1e12 / 50 = 6 * 1e12
        expect(await pool.poolRewardAccPerShare(zklTokenId, tokenC.address)).to.eq(hardhat.ethers.utils.parseUnits('6', 12));
        poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.lastRewardBlock).to.eq(120);
        // pool can only be update once at the same block
        await pool.updatePool(zklTokenId);
        expect(await pool.poolRewardAccPerShare(zklTokenId, zkl.address)).to.eq(hardhat.ethers.utils.parseUnits('2', 13));
        poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.lastRewardBlock).to.eq(120);
    });

    it('stake when no pool should fail', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.be.revertedWith('StakePool: pool not existed');

        // add pool and then freeze pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 1));
        await pool.connect(networkGovernor).freezePool(zklTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.be.revertedWith('StakePool: pool not existed');
    });

    it('stake ADD_PENDING nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 1));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        // pool should know who staked this nft
        expect(await pool.nftDepositor(nftTokenId)).to.eq(alice.address);
        // pool power should increase amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(amount);
        // user power should be zero and flag this nft to pending
        expect(await pool.userPower(zklTokenId, alice.address)).to.eq(0);
        expect(await pool.isUserFinalNft(zklTokenId, alice.address, nftTokenId)).to.eq(false);
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId)).to.eq(true);
    });

    it('stake FINAL nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 1));
        // mint nft and confirm
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.confirmAddLq(nft.address, nftTokenId, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        // pool should know who staked this nft
        expect(await pool.nftDepositor(nftTokenId)).to.eq(alice.address);
        // pool power should increase amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(amount);
        // user power should increase amount and should not flag this nft to pending
        expect(await pool.userPower(zklTokenId, alice.address)).to.eq(amount);
        expect(await pool.isUserFinalNft(zklTokenId, alice.address, nftTokenId)).to.eq(true);
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId)).to.eq(false);
    });

    it('stake ADD_FAIL nft should fail', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 1));
        // mint nft and revoke
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.revokeAddLq(nft.address, nftTokenId);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.be.revertedWith("StakePool: invalid nft status");
    });

    it('unStake nft of not yourself should fail', async () => {
        await expect(pool.connect(alice).unStake(1)).to.be.revertedWith("StakePool: not depositor");
    });

    it('unStake ADD_PENDING -> ADD_PENDING or ADD_FAIL nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId, zkl.address, 10000);
        // unStake nft from pool
        await expect(pool.connect(alice).unStake(nftTokenId)).to.emit(pool, 'UnStake').withArgs(alice.address, nftTokenId);
        // nft should has no depositor in pool
        expect(await pool.nftDepositor(nftTokenId)).to.eq(hardhat.ethers.constants.AddressZero);
        // pool power should decrease amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(0);
        // un flag this pending nft
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId)).to.eq(false);
        // this pending nft acc reward should move to discard reward per block
        expect(await pool.poolRewardDiscardPerBlock(zklTokenId, zkl.address)).to.eq(2000);
    });

    it('unStake ADD_PENDING -> FINAL nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId, zkl.address, 10000);
        const nftPendingReward = 10000; // nftPower*poolAccPerShare/1e12 - userNftPendingRewardDebt
        await zkl.connect(networkGovernor).transfer(pool.address, nftPendingReward);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId, 1);
        // unStake nft from pool
        await expect(pool.connect(alice).unStake(nftTokenId)).to.emit(pool, 'UnStake').withArgs(alice.address, nftTokenId);
        // nft should has no depositor in pool
        expect(await pool.nftDepositor(nftTokenId)).to.eq(hardhat.ethers.constants.AddressZero);
        expect(await nft.ownerOf(nftTokenId)).to.eq(alice.address);
        // pool power should decrease amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(0);
        // un flag this pending nft
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId)).to.eq(false);
        // user should get pending nft acc reward
        expect(await zkl.balanceOf(alice.address)).to.eq(nftPendingReward);
    });

    it('unStake FINAL -> FINAL nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        expect(await pool.userPower(zklTokenId, alice.address)).to.eq(amount);
        // unStake nft from pool
        await expect(pool.connect(alice).unStake(nftTokenId)).to.emit(pool, 'UnStake').withArgs(alice.address, nftTokenId);
        // nft should has no depositor in pool
        expect(await pool.nftDepositor(nftTokenId)).to.eq(hardhat.ethers.constants.AddressZero);
        expect(await nft.ownerOf(nftTokenId)).to.eq(alice.address);
        // pool power should decrease amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(0);
        // user power should decrease amount
        expect(await pool.userPower(zklTokenId, alice.address)).to.eq(0);
    });

    it('emergency unStake nft should success', async () => {
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        // only final nft can emergency unStake
        await expect(pool.connect(alice).emergencyUnStake(nftTokenId)).to.be.revertedWith("StakePool: only FINAL nft can emergency unStake");
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId, 1);
        // unStake nft from pool
        await expect(pool.connect(alice).emergencyUnStake(nftTokenId)).to.emit(pool, 'EmergencyUnStake').withArgs(alice.address, nftTokenId);
        // nft should has no depositor in pool
        expect(await pool.nftDepositor(nftTokenId)).to.eq(hardhat.ethers.constants.AddressZero);
        expect(await nft.ownerOf(nftTokenId)).to.eq(alice.address);
        // pool power should decrease amount
        const poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(0);
        // un flag this pending nft
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId)).to.eq(false);
    });

    it('revoke invalid nft should fail', async () => {
        await expect(pool.connect(alice).revokePendingNft(0)).to.be.revertedWith("StakePool: nft not staked");
        const zklTokenId = 1;
        const amount = 100;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 100000, 200000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, amount, hardhat.ethers.constants.AddressZero);
        const nftTokenId = await nft.tokenOfOwnerByIndex(alice.address, 0);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId);
        await expect(pool.connect(alice).stake(nftTokenId)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId);
        await expect(pool.connect(alice).revokePendingNft(nftTokenId)).to.be.revertedWith("StakePool: require nft ADD_FAIL");
    });

    it('revoke ADD_PENDING -> ADD_FAIL nft should success', async () => {
        const zklTokenId = 1;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 1000, 2000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 100, hardhat.ethers.constants.AddressZero);
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 200, hardhat.ethers.constants.AddressZero);
        const nftTokenId0 = await nft.tokenOfOwnerByIndex(alice.address, 0);
        const nftTokenId1 = await nft.tokenOfOwnerByIndex(alice.address, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId0);
        await nft.connect(alice).approve(pool.address, nftTokenId1);
        await expect(pool.connect(alice).stake(nftTokenId0)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId0);
        await expect(pool.connect(alice).stake(nftTokenId1)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId1);
        // add lq fail
        await zkLink.revokeAddLq(nft.address, nftTokenId0);
        await zkLink.revokeAddLq(nft.address, nftTokenId1);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setBlockNumber(1500);
        await pool.setPoolPower(zklTokenId, 500);
        await pool.setPoolLastRewardBlock(zklTokenId, 1490);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, zkl.address, 100);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, zkl.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, zkl.address, 2000);
        // revoke nft0 from pool
        await expect(pool.revokePendingNft(nftTokenId0)).to.emit(pool, 'RevokePendingNft').withArgs(nftTokenId0);
        // pool power should decrease amount
        let poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(400);
        // nft should transfer to alice
        expect(await pool.nftDepositor(nftTokenId0)).to.eq(hardhat.ethers.constants.AddressZero);
        expect(await nft.ownerOf(nftTokenId0)).to.eq(alice.address);
        // un flag this pending nft
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId0)).to.eq(false);
        // discard reward info should update correctly
        // pending = 100*200*1e12/1e12-1000=19000
        // un released discard reward = 5*100=500
        // discard per block = (19000+500)/5=3900
        expect(poolInfo.discardRewardStartBlock).to.eq(1490);
        expect(poolInfo.discardRewardEndBlock).to.eq(1495);
        expect(await pool.poolRewardDiscardPerBlock(zklTokenId, zkl.address)).to.eq(3900);

        // revoke nft1 from pool
        await expect(pool.revokePendingNft(nftTokenId1)).to.emit(pool, 'RevokePendingNft').withArgs(nftTokenId1);
        // pool power should decrease amount
        poolInfo = await pool.poolInfo(zklTokenId);
        expect(poolInfo.power).to.eq(200);
        // nft should transfer to alice
        expect(await pool.nftDepositor(nftTokenId1)).to.eq(hardhat.ethers.constants.AddressZero);
        expect(await nft.ownerOf(nftTokenId1)).to.eq(alice.address);
        // un flag this pending nft
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId1)).to.eq(false);
        // discard reward info should update correctly
        // pending = 200*200*1e12/1e12-2000=38000
        // un released discard reward = 5*3900=19500
        // discard per block = (38000+19500)/5=11500
        expect(poolInfo.discardRewardStartBlock).to.eq(1490);
        expect(poolInfo.discardRewardEndBlock).to.eq(1495);
        expect(await pool.poolRewardDiscardPerBlock(zklTokenId, zkl.address)).to.eq(11500);
    });

    it('get zkl pending reward should success', async () => {
        const zklTokenId = 1;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, hardhat.ethers.constants.AddressZero, 1000, 2000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 100, hardhat.ethers.constants.AddressZero);
        const nftTokenId0 = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 200, hardhat.ethers.constants.AddressZero);
        const nftTokenId1 = await nft.tokenOfOwnerByIndex(alice.address, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId0);
        await nft.connect(alice).approve(pool.address, nftTokenId1);
        await expect(pool.connect(alice).stake(nftTokenId0)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId0);
        await expect(pool.connect(alice).stake(nftTokenId1)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId1);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId0, 1);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setBlockNumber(1500);
        await pool.setPoolPower(zklTokenId, 100);
        await pool.setPoolLastRewardBlock(zklTokenId, 1490);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, zkl.address, 100);
        await pool.setUserPower(zklTokenId, alice.address, 20);
        await pool.setUserRewardDebt(zklTokenId, alice.address, zkl.address, 0);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, zkl.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, zkl.address, 2000);
        // zkl pending reward should conclude share update to current block
        // accPerShare pre value = 200*1e12
        // reward blocks = 10, reward increment = 10*100 = 1000
        // discardRewardBlocks = 5, discard reward increment = 5*100 = 500
        // accShare increment = (1000+500)*1e12/100 = 15*1e12
        // accPerShare cur value = 200*1e12+15*1e12 = 215*1e12
        // reward amount = 20*215*1e12/1e12-0 = 4300
        // nft0 acc reward = 100*215*1e12/1e12-1000 = 20500
        // pending = 4300+20500 = 24800
        expect(await pool.pendingReward(zklTokenId, zkl.address, alice.address)).to.eq(24800);
    });

    it('get other pending reward should success', async () => {
        const zklTokenId = 1;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, strategy.address, 1000, 2000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 100, hardhat.ethers.constants.AddressZero);
        const nftTokenId0 = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 200, hardhat.ethers.constants.AddressZero);
        const nftTokenId1 = await nft.tokenOfOwnerByIndex(alice.address, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId0);
        await nft.connect(alice).approve(pool.address, nftTokenId1);
        await expect(pool.connect(alice).stake(nftTokenId0)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId0);
        await expect(pool.connect(alice).stake(nftTokenId1)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId1);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId0, 1);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, tokenB.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setBlockNumber(1500);
        await pool.setPoolPower(zklTokenId, 100);
        await pool.setPoolLastRewardBlock(zklTokenId, 1490);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, tokenB.address, 100);
        await pool.setUserPower(zklTokenId, alice.address, 20);
        await pool.setUserRewardDebt(zklTokenId, alice.address, tokenB.address, 500);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, tokenB.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, tokenB.address, 2000);
        // other pending reward should not conclude share update to current block
        // accPerShare pre value = 200*1e12 + 500*1e12/100=205*1e12
        // reward amount = 20*205*1e12/1e12-500 = 3600
        // nft0 acc reward = 100*205*1e12/1e12-1000 = 19500
        // pending = 3600+19500 = 23100
        expect(await pool.pendingReward(zklTokenId, tokenB.address, alice.address)).to.eq(23100);
    });

    it('get pending rewards should success', async () => {
        const zklTokenId = 1;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, strategy.address, 1000, 2000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 100, hardhat.ethers.constants.AddressZero);
        const nftTokenId0 = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 200, hardhat.ethers.constants.AddressZero);
        const nftTokenId1 = await nft.tokenOfOwnerByIndex(alice.address, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId0);
        await nft.connect(alice).approve(pool.address, nftTokenId1);
        await expect(pool.connect(alice).stake(nftTokenId0)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId0);
        await expect(pool.connect(alice).stake(nftTokenId1)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId1);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId0, 1);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setPoolAccPerShare(zklTokenId, tokenB.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setBlockNumber(1500);
        await pool.setPoolPower(zklTokenId, 100);
        await pool.setPoolLastRewardBlock(zklTokenId, 1490);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, zkl.address, 100);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, tokenB.address, 100);
        await pool.setUserPower(zklTokenId, alice.address, 20);
        await pool.setUserRewardDebt(zklTokenId, alice.address, zkl.address, 0);
        await pool.setUserRewardDebt(zklTokenId, alice.address, tokenB.address, 500);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, zkl.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, zkl.address, 2000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, tokenB.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, tokenB.address, 2000);
        // get pending rewards
        const rewardInfo = await pool.pendingRewards(zklTokenId, alice.address);
        const addressList = rewardInfo[0];
        const amountList = rewardInfo[1];
        expect(addressList[0]).to.eq(zkl.address);
        expect(addressList[1]).to.eq(tokenB.address);
        expect(addressList[2]).to.eq(tokenC.address);
        expect(amountList[0]).to.eq(24800);
        expect(amountList[1]).to.eq(23100);
        expect(amountList[2]).to.eq(0);
    });

    it('harvest should success', async () => {
        const zklTokenId = 1;
        // add pool
        await expect(pool.connect(networkGovernor).addPool(zklTokenId, strategy.address, 1000, 2000, 100, 5));
        // mint nft
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 100, hardhat.ethers.constants.AddressZero);
        const nftTokenId0 = await nft.tokenOfOwnerByIndex(alice.address, 0);
        await zkLink.addLq(nft.address, alice.address, zklTokenId, 200, hardhat.ethers.constants.AddressZero);
        const nftTokenId1 = await nft.tokenOfOwnerByIndex(alice.address, 1);
        // approve nft to pool and then stake
        await nft.connect(alice).approve(pool.address, nftTokenId0);
        await nft.connect(alice).approve(pool.address, nftTokenId1);
        await expect(pool.connect(alice).stake(nftTokenId0)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId0);
        await expect(pool.connect(alice).stake(nftTokenId1)).to.emit(pool, 'Stake').withArgs(alice.address, nftTokenId1);
        // add lq success
        await zkLink.confirmAddLq(nft.address, nftTokenId0, 1);
        // mock pool status
        await pool.setPoolAccPerShare(zklTokenId, zkl.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setPoolAccPerShare(zklTokenId, tokenB.address, hardhat.ethers.utils.parseUnits("2", 14)); // 200 * 1e12
        await pool.setBlockNumber(1500);
        await pool.setPoolPower(zklTokenId, 100);
        await pool.setPoolLastRewardBlock(zklTokenId, 1490);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, zkl.address, 100);
        await pool.setPoolDiscard(zklTokenId, 1480, 1495, tokenB.address, 100);
        await pool.setUserPower(zklTokenId, alice.address, 20);
        await pool.setUserRewardDebt(zklTokenId, alice.address, zkl.address, 0);
        await pool.setUserRewardDebt(zklTokenId, alice.address, tokenB.address, 500);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, zkl.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, zkl.address, 2000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId0, tokenB.address, 1000);
        await pool.setUserPendingRewardDebt(zklTokenId, alice.address, nftTokenId1, tokenB.address, 2000);
        await zkl.connect(networkGovernor).transfer(pool.address, 100000);
        await tokenB.mintTo(pool.address, 100000);
        await tokenC.mintTo(pool.address, 100000);
        await pool.connect(alice).harvest(zklTokenId);
        // zkl reward
        expect(await zkl.balanceOf(alice.address)).to.eq(24800);
        // user pre power = 20, after harvest nft0 power add to user total power
        // zkl cur accShare = 215*1e12
        // reward debt = 120*215*1e12/1e12 = 25800
        expect(await pool.userRewardDebt(zklTokenId, alice.address, zkl.address)).to.eq(25800);
        // tokenB reward
        // strategy put 100 tokenB to pool, tokenB acc share increment from strategy = 100*1e12/100=1e12
        // tokenB reward = (205*1e12+1*1e12)*20/1e12-500+100*206*1e12/1e12-1000=23220
        expect(await tokenB.balanceOf(alice.address)).to.eq(23220);
        // reward debt = 120*206*1e12/1e12 = 24720
        expect(await pool.userRewardDebt(zklTokenId, alice.address, tokenB.address)).to.eq(24720);
        // tokenC reward
        // strategy put 300 tokenB to pool, tokenC acc share increment from strategy = 300*1e12/100=3*1e12
        // tokenC reward = 3*1e12*20/1e12 + 100*3*1e12/1e12 = 360
        expect(await tokenC.balanceOf(alice.address)).to.eq(360);
        // reward debt = 120*3*1e12/1e12 = 360
        expect(await pool.userRewardDebt(zklTokenId, alice.address, tokenC.address)).to.eq(360);
        // un flag nft0
        expect(await pool.isUserPendingNft(zklTokenId, alice.address, nftTokenId0)).to.eq(false);

        let userRewarded = await pool.userRewarded(zklTokenId, alice.address);
        let allRewardTokens = userRewarded[0];
        let allRewardAmounts = userRewarded[1];
        expect(allRewardTokens[0]).eq(zkl.address);
        expect(allRewardTokens[1]).eq(tokenB.address);
        expect(allRewardTokens[2]).eq(tokenC.address);
        expect(allRewardAmounts[0]).eq(24800);
        expect(allRewardAmounts[1]).eq(23220);
        expect(allRewardAmounts[2]).eq(360);
    });
});
