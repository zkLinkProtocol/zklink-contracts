const hardhat = require('hardhat');
const { expect } = require('chai');
const {calFee} = require('./utils');

describe('Vault unit tests', function () {
    let vault;
    let zkSync;
    let deployer, governor, alice, userReward, protocolReward;
    let tokenA, tokenAId;
    let strategyA, strategyB;
    let zkSyncUser;
    beforeEach(async () => {
        [deployer, governor, alice, userReward, protocolReward] = await hardhat.ethers.getSigners();
        // governance, governor is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governor.address])
        );
        // vault
        const contractFactory = await hardhat.ethers.getContractFactory('VaultTest');
        vault = await contractFactory.deploy();
        await vault.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'],
                [governance.address])
        );
        // zkSync
        const zkSyncFactory = await hardhat.ethers.getContractFactory('SimpleZkSync');
        zkSync = await zkSyncFactory.deploy(governance.address, vault.address);
        await vault.setZkSyncAddress(zkSync.address);
        // tokenA
        const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
        tokenA = await erc20Factory.deploy(10000);
        await governance.connect(governor).addToken(tokenA.address);
        tokenAId = await governance.validateTokenAddress(tokenA.address);
        // strategyA without loss
        const strategyFactory = await hardhat.ethers.getContractFactory('SimpleStrategy');
        strategyA = await strategyFactory.deploy(vault.address, tokenA.address, tokenAId, 0);
        // strategyB with 10% loss
        strategyB = await strategyFactory.deploy(vault.address, tokenA.address, tokenAId, 1000);
        // ZkSyncUser
        const zkSyncUserFactor = await hardhat.ethers.getContractFactory('ZkSyncUser');
        zkSyncUser = await zkSyncUserFactor.deploy(zkSync.address);
    });

    it('should revert when need to call from zkSync', async () => {
        await expect(vault.recordDeposit(tokenAId, 10)).to.be.revertedWith('Vault: require ZkSync');
        await expect(vault.withdraw(tokenAId, alice.address, 10, 10, 0)).to.be.revertedWith('Vault: require ZkSync');
    });

    it('should revert when need to call from governor', async () => {
        await expect(vault.setTokenReserveRatio(tokenAId, 10)).to.be.revertedWith('1g');
        await expect(vault.setReward(userReward.address, protocolReward.address, 10)).to.be.revertedWith('1g');
        await expect(vault.addStrategy(strategyA.address)).to.be.revertedWith('1g');
        await expect(vault.revokeStrategy(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.upgradeStrategy(strategyA.address)).to.be.revertedWith('1g');
        await expect(vault.revokeUpgradeStrategy(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.transferToStrategy(tokenAId, 1)).to.be.revertedWith('1g');
        await expect(vault.settleReward(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.harvest(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.emergencyExit(tokenAId)).to.be.revertedWith('1g');
    });

    it('set reserve ratio should success', async () => {
        await expect(vault.connect(governor).setTokenReserveRatio(tokenAId, 10)).to.emit(vault, 'ReserveRatioUpdate').withArgs(tokenAId, 10);
        await expect(vault.connect(governor).setTokenReserveRatio(tokenAId, 10001)).to.revertedWith('Vault: over max bps');
    });

    it('set reward should success', async () => {
        await expect(vault.connect(governor).setReward(userReward.address, protocolReward.address, 10000))
            .to.emit(vault, 'RewardConfigUpdate')
            .withArgs(userReward.address, protocolReward.address, 10000);
        await expect(vault.connect(governor).setReward(userReward.address, protocolReward.address, 10001)).to.revertedWith('Vault: over max bps');
    });

    it('deposit eth from zksync should success', async () => {
        await zkSync.depositETH(alice.address, {value:50});
        expect(await vault.totalAsset(0)).to.equal(50);
        expect(await vault.totalDebt(0)).to.equal(50);
    });

    it('deposit erc20 from zksync should success', async () => {
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        expect(await vault.totalAsset(tokenAId)).to.equal(100);
        expect(await vault.totalDebt(tokenAId)).to.equal(100);
    });

    it('eoa address withdraw eth from zksync should success', async () => {
        await zkSync.depositETH(alice.address, {value:50});
        let b0 = await alice.getBalance();
        let tx = await zkSync.connect(alice).withdrawPendingBalance(alice.address, hardhat.ethers.constants.AddressZero, 20, 0);
        let fee = await calFee(tx);
        let b1 = await alice.getBalance();
        expect(b1.add(fee).sub(b0)).equal(20);
        expect(await vault.totalAsset(0)).to.equal(30);
        expect(await vault.totalDebt(0)).to.equal(30);
    });

    it('contract address withdraw eth from zksync should success', async () => {
        await zkSync.depositETH(zkSyncUser.address, {value:50});
        let b0 = await hardhat.ethers.provider.getBalance(zkSyncUser.address);
        await zkSyncUser.withdrawETH(20);
        let b1 = await hardhat.ethers.provider.getBalance(zkSyncUser.address);
        expect(b1.sub(b0)).equal(20);
        expect(await vault.totalAsset(0)).to.equal(30);
        expect(await vault.totalDebt(0)).to.equal(30);
    });

    it('withdraw erc20 from zksync should success', async () => {
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        let b0 = await tokenA.balanceOf(alice.address);
        await zkSync.connect(alice).withdrawPendingBalance(alice.address, tokenA.address, 60, 0);
        let b1 = await tokenA.balanceOf(alice.address);
        expect(b1.sub(b0)).equal(60);
        expect(await vault.totalAsset(tokenAId)).to.equal(40);
        expect(await vault.totalDebt(tokenAId)).to.equal(40);
    });

    it('withdraw with loss', async () => {
        // strategyB will loss 10% when withdraw
        await vault.buildActiveTest(tokenAId, strategyB.address);
        await vault.connect(governor).setTokenReserveRatio(tokenAId, 0);

        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        await vault.connect(governor).transferToStrategy(tokenAId, 90);
        await zkSync.connect(alice).withdrawPendingBalance(alice.address, tokenA.address, 60, 10000); // accept 100% loss
        expect(await tokenA.balanceOf(alice.address)).to.equal(55);

        await expect(zkSync.connect(alice).withdrawPendingBalance(alice.address, tokenA.address, 20, 500)).to.be.revertedWith('Vault: over loss');
    });

    it('should fail when strategy is zero address', async () => {
        await expect(vault.connect(governor).addStrategy(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('Vault: zero strategy address');
        await expect(vault.connect(governor).upgradeStrategy(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('Vault: zero strategy address');
    });

    it('should fail when strategy want is invalid', async () => {
        const strategyFactory = await hardhat.ethers.getContractFactory('SimpleStrategy');
        const strategy = await strategyFactory.deploy(vault.address, '0xe4815AE53B124e7263F08dcDBBB757d41Ed658c6', 2, 0);
        await expect(vault.connect(governor).addStrategy(strategy.address)).to.be.revertedWith('Vault: token not exist');
    });

    it('add strategy should success', async () => {
        await expect(vault.connect(governor).addStrategy(strategyA.address))
            .to.emit(vault, 'StrategyAdd')
            .withArgs(tokenAId, strategyA.address);

        await expect(vault.connect(governor).addStrategy(strategyA.address)).to.be.revertedWith('Vault: strategy already exist');
    });

    it('revoke strategy should success', async () => {
        await expect(vault.connect(governor).revokeStrategy(tokenAId)).to.be.revertedWith('Vault: no strategy');

        await vault.connect(governor).addStrategy(strategyA.address);
        await expect(vault.connect(governor).revokeStrategy(tokenAId))
            .to.emit(vault, 'StrategyRevoke')
            .withArgs(tokenAId);

        // add strategy after revoke should success
        await expect(vault.connect(governor).addStrategy(strategyA.address))
            .to.emit(vault, 'StrategyAdd')
            .withArgs(tokenAId, strategyA.address);
    });

    it('active strategy before takeEffectiveTime should fail', async () => {
        await expect(vault.connect(governor).activeStrategy(tokenAId)).to.be.revertedWith('Vault: no strategy');

        await vault.connect(governor).addStrategy(strategyA.address);
        await expect(vault.connect(governor).activeStrategy(tokenAId)).to.be.revertedWith('Vault: time not reach');
    });

    it('active strategy after takeEffectiveTime should success', async () => {
        await vault.connect(governor).addStrategy(strategyA.address);
        await vault.setStrategyTakeEffectTime(tokenAId, 0);
        await expect(vault.connect(governor).activeStrategy(tokenAId))
            .to.emit(vault, 'StrategyActive')
            .withArgs(tokenAId);

        // after active, cannot add or revoke
        await expect(vault.connect(governor).addStrategy(strategyA.address)).to.be.revertedWith('Vault: strategy already exist');
        await expect(vault.connect(governor).revokeStrategy(tokenAId)).to.be.revertedWith('Vault: require added');
    });

    it('upgrade strategy and revoke upgrade should success', async () => {
        await vault.connect(governor).addStrategy(strategyA.address);
        await vault.setStrategyTakeEffectTime(tokenAId, 0);
        await expect(vault.connect(governor).activeStrategy(tokenAId))
            .to.emit(vault, 'StrategyActive')
            .withArgs(tokenAId);

        // after active, can upgrade
        await expect(vault.connect(governor).upgradeStrategy(strategyA.address)).to.be.revertedWith('Vault: upgrade to self');
        await expect(vault.connect(governor).upgradeStrategy(strategyB.address))
            .to.emit(vault, 'StrategyUpgradePrepare')
            .withArgs(tokenAId, strategyB.address);

        // after set upgrade contract, can revoke upgrade
        await expect(vault.connect(governor).revokeUpgradeStrategy(tokenAId))
            .to.emit(vault, 'StrategyRevokeUpgrade')
            .withArgs(tokenAId);
    });

    it('migrate strategy should success', async () => {
        await tokenA.transfer(strategyA.address, 200);
        await vault.buildMigrateTest(tokenAId, strategyA.address, strategyB.address);
        await expect(vault.connect(governor).migrateStrategy(tokenAId))
            .to.emit(vault, 'StrategyMigrate')
            .withArgs(tokenAId);
        expect(await tokenA.balanceOf(strategyB.address)).to.equal(200);

        expect(await vault.getStrategy(tokenAId)).to.equal(strategyB.address);
        expect(await vault.getNextStrategy(tokenAId)).to.equal(hardhat.ethers.constants.AddressZero);
    });

    it('exit strategy should success', async () => {
        await vault.buildActiveTest(tokenAId, strategyA.address);
        await expect(vault.connect(governor).emergencyExit(tokenAId))
            .to.emit(vault, 'StrategyExit')
            .withArgs(tokenAId);
        // after exit we can upgrade to new strategy
        await expect(vault.connect(governor).upgradeStrategy(strategyB.address))
            .to.emit(vault, 'StrategyUpgradePrepare')
            .withArgs(tokenAId, strategyB.address);
    });

    it('get transfer to strategy amount should success', async () => {
        expect(await vault.getStrategyAvailableTransferAmount(tokenAId)).to.equal(0);
        await vault.buildActiveTest(tokenAId, strategyA.address);
        expect(await vault.getStrategyAvailableTransferAmount(tokenAId)).to.equal(0);

        await vault.connect(governor).setTokenReserveRatio(tokenAId, 1500); // 15%
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        expect(await vault.getStrategyAvailableTransferAmount(tokenAId)).to.equal(85);
    });

    it('transfer to strategy should success', async () => {
        await vault.buildActiveTest(tokenAId, strategyA.address);
        await vault.connect(governor).setTokenReserveRatio(tokenAId, 1500); // 15%
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);

        await expect(vault.connect(governor).transferToStrategy(tokenAId, 15))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(tokenAId, strategyA.address, 15);

        await expect(vault.connect(governor).transferToStrategy(tokenAId, 100))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(tokenAId, strategyA.address, 70);

        expect(await tokenA.balanceOf(strategyA.address)).to.equal(85);
    });

    it('settle reward should success', async () => {
        await vault.connect(governor).setReward(userReward.address, protocolReward.address, 2000); // 20%

        // transfer 150 to vault => asset = 150
        await tokenA.transfer(vault.address, 150);
        // debt = 0, profit = 150, protocol reward = 30, user reward = 120
        expect(await vault.connect(governor).settleReward(tokenAId))
            .to.emit(vault, 'SettleReward')
            .withArgs(tokenAId, userReward.address, protocolReward.address, 120, 30);
        expect(await tokenA.balanceOf(vault.address)).to.equal(150);
        expect(await vault.totalAsset(tokenAId)).to.equal(150);
        expect(await vault.totalDebt(tokenAId)).to.equal(150);

        await alice.sendTransaction({to:vault.address, value:3000});
        expect(await vault.connect(governor).settleReward(0))
            .to.emit(vault, 'SettleReward')
            .withArgs(0, userReward.address, protocolReward.address, 2400, 600);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(3000);
        expect(await vault.totalAsset(0)).to.equal(3000);
        expect(await vault.totalDebt(0)).to.equal(3000);
    });

    it('strategy harvest should success', async () => {
        await vault.buildActiveTest(tokenAId, strategyA.address);
        await expect(vault.connect(governor).emergencyExit(tokenAId))
            .to.emit(vault, 'StrategyExit')
            .withArgs(tokenAId);
        // after exit we can upgrade to new strategy
        await expect(vault.connect(governor).upgradeStrategy(strategyB.address))
            .to.emit(vault, 'StrategyUpgradePrepare')
            .withArgs(tokenAId, strategyB.address);
    });
});
