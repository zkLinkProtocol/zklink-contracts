const hardhat = require('hardhat');
const { expect } = require('chai');
const {calFee} = require('./utils');

describe('Vault unit tests', function () {
    let vault;
    let zkSync;
    let pool;
    let deployer, governor, alice;
    let tokenA, tokenAId;
    let strategyA, strategyB;
    let zkSyncUser;
    beforeEach(async () => {
        [deployer, governor, alice, pool] = await hardhat.ethers.getSigners();
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
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        tokenA = await erc20Factory.deploy(10000);
        await governance.connect(governor).addToken(tokenA.address, false);
        tokenAId = await governance.validateTokenAddress(tokenA.address);
        // strategyA
        const strategyFactory = await hardhat.ethers.getContractFactory('SimpleStrategy');
        strategyA = await strategyFactory.deploy(vault.address, tokenAId, tokenA.address, pool.address, []);
        // strategyB
        strategyB = await strategyFactory.deploy(vault.address, tokenAId, tokenA.address, pool.address, []);
        // ZkSyncUser
        const zkSyncUserFactor = await hardhat.ethers.getContractFactory('ZkSyncUser');
        zkSyncUser = await zkSyncUserFactor.deploy(zkSync.address);
    });

    it('should revert when need to call from zkSync', async () => {
        await expect(vault.recordDeposit(tokenAId)).to.be.revertedWith('Vault: require ZkSync');
        await expect(vault.withdraw(tokenAId, alice.address, 10)).to.be.revertedWith('Vault: require ZkSync');
    });

    it('should revert when need to call from governor', async () => {
        await expect(vault.addStrategy(strategyA.address)).to.be.revertedWith('1g');
        await expect(vault.revokeStrategy(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.upgradeStrategy(strategyA.address)).to.be.revertedWith('1g');
        await expect(vault.revokeUpgradeStrategy(tokenAId)).to.be.revertedWith('1g');
        await expect(vault.emergencyExit(tokenAId)).to.be.revertedWith('1g');
    });

    it('deposit eth from zksync should success', async () => {
        await zkSync.depositETH(alice.address, {value:50});
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(50);
    });

    it('deposit erc20 from zksync should success', async () => {
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        expect(await tokenA.balanceOf(vault.address)).to.equal(100);
    });

    it('eoa address withdraw eth from zksync should success', async () => {
        await zkSync.depositETH(alice.address, {value:50});
        let b0 = await alice.getBalance();
        let tx = await zkSync.connect(alice).withdrawPendingBalance(alice.address, hardhat.ethers.constants.AddressZero, 20);
        let fee = await calFee(tx);
        let b1 = await alice.getBalance();
        expect(b1.add(fee).sub(b0)).equal(20);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(30);
    });

    it('contract address withdraw eth from zksync should success', async () => {
        await zkSync.depositETH(zkSyncUser.address, {value:50});
        let b0 = await hardhat.ethers.provider.getBalance(zkSyncUser.address);
        await zkSyncUser.withdrawETH(20);
        let b1 = await hardhat.ethers.provider.getBalance(zkSyncUser.address);
        expect(b1.sub(b0)).equal(20);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(30);
    });

    it('withdraw erc20 from zksync should success', async () => {
        await tokenA.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenA.address, 100, alice.address);
        let b0 = await tokenA.balanceOf(alice.address);
        await zkSync.connect(alice).withdrawPendingBalance(alice.address, tokenA.address, 60);
        let b1 = await tokenA.balanceOf(alice.address);
        expect(b1.sub(b0)).equal(60);
        expect(await tokenA.balanceOf(vault.address)).to.equal(40);
    });

    it('should fail when strategy is zero address', async () => {
        await expect(vault.connect(governor).addStrategy(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('Vault: zero strategy address');
        await expect(vault.connect(governor).upgradeStrategy(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('Vault: zero strategy address');
    });

    it('should fail when strategy want is invalid', async () => {
        const strategyFactory = await hardhat.ethers.getContractFactory('SimpleStrategy');
        const strategy = await strategyFactory.deploy(vault.address, 2, '0xe4815AE53B124e7263F08dcDBBB757d41Ed658c6', pool.address, []);
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
});
