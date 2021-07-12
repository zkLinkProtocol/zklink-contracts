const hardhat = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');

describe('YearnStrategy unit tests', function () {
    let vault;
    let deployer, governor, alice;
    const ethId = 0;
    let weth, wethId;
    let usdt, usdtId;
    let wethYearn, usdtYearn;
    let usdtYearnBorrower;
    let strategyFactory;
    let ethStrategy, wethStrategy, usdtStrategy;
    before(async () => {
        [deployer, governor, alice] = await hardhat.ethers.getSigners();
        // governance, governor is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governor.address])
        );
        // vault
        const contractFactory = await hardhat.ethers.getContractFactory('VaultTest');
        vault = await contractFactory.deploy();
        expect(vault.address).to.equal('0xFD6D23eE2b6b136E34572fc80cbCd33E9787705e');
        await vault.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'],
                [governance.address])
        );
        // weth
        const wethFactory = await hardhat.ethers.getContractFactory('WETH');
        weth = await wethFactory.deploy();
        expect(weth.address).to.equal('0x1D13fF25b10C9a6741DFdce229073bed652197c7');
        await governance.connect(governor).addToken(weth.address);
        wethId = await governance.validateTokenAddress(weth.address);
        // usdt
        const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
        usdt = await erc20Factory.deploy(0);
        await governance.connect(governor).addToken(usdt.address);
        usdtId = await governance.validateTokenAddress(usdt.address);
    });

    beforeEach(async () => {
        // yearn
        const yearnFactory = await hardhat.ethers.getContractFactory('MockYearn');
        wethYearn = await yearnFactory.deploy(weth.address, 0);
        usdtYearn = await yearnFactory.deploy(usdt.address, 0);
        const yearnBorrowerFactory = await hardhat.ethers.getContractFactory('MockYearnBorrower');
        usdtYearnBorrower = yearnBorrowerFactory.attach(await usdtYearn.borrower());
        // yearn strategy
        strategyFactory = await hardhat.ethers.getContractFactory('YearnStrategyTest');
        ethStrategy = await strategyFactory.deploy(ethId, wethYearn.address);
        wethStrategy = await strategyFactory.deploy(wethId, wethYearn.address);
        usdtStrategy = await strategyFactory.deploy(usdtId, usdtYearn.address);
        // add strategy to vault
        await vault.buildActiveTest(ethId, ethStrategy.address); // eth -> weth strategy
        await vault.buildActiveTest(wethId, wethStrategy.address); // weth -> weth strategy
        await vault.buildActiveTest(usdtId, usdtStrategy.address); // usdt -> usdt strategy
    });

    it('should revert when need to call from vault', async () => {
        await expect(ethStrategy.deposit()).to.be.revertedWith('BaseStrategy: require Vault');
        await expect(ethStrategy.withdraw(0)).to.be.revertedWith('BaseStrategy: require Vault');
        await expect(ethStrategy.harvest()).to.be.revertedWith('BaseStrategy: require Vault');
        await expect(ethStrategy.migrate(wethStrategy.address)).to.be.revertedWith('BaseStrategy: require Vault');
        await expect(ethStrategy.onMigrate()).to.be.revertedWith('BaseStrategy: require Vault');
        await expect(ethStrategy.emergencyExit()).to.be.revertedWith('BaseStrategy: require Vault');
    });

    it('no shares at yearn', async () => {
        expect(await usdtStrategy.wantNetValue()).to.equal(0);
    });

    it('yearn has shares and no earn', async () => {
        // yearn has shares
        // share price is 1
        // vault has shares
        await usdt.mintTo(usdtYearn.address, hardhat.ethers.utils.parseUnits('10000'));
        await usdtYearn.mintTo(usdtStrategy.address, hardhat.ethers.utils.parseUnits('2000'));
        await usdtYearn.mintTo(alice.address, hardhat.ethers.utils.parseUnits('8000'));
        expect(await usdtStrategy.wantNetValue()).to.equal(hardhat.ethers.utils.parseUnits('2000'));
    });

    it('yearn has shares and has earn', async () => {
        // yearn has shares
        // share price > 1
        // vault has shares
        await usdt.mintTo(usdtYearn.address, hardhat.ethers.utils.parseUnits('10112'));
        await usdtYearn.mintTo(usdtStrategy.address, hardhat.ethers.utils.parseUnits('2000'));
        await usdtYearn.mintTo(alice.address, hardhat.ethers.utils.parseUnits('8000'));
        expect(await usdtStrategy.wantNetValue()).to.equal(hardhat.ethers.utils.parseUnits('2022.4'));
    });

    it('deposit eth', async () => {
        // transfer 100 eth to vault and record deposit
        await alice.sendTransaction({to:vault.address, value: hardhat.ethers.utils.parseUnits('100')});
        await vault.recordDepositTest(ethId, hardhat.ethers.utils.parseUnits('100'));
        // set eth reserve ratio to 15%, only 85 eth can transfer to strategy
        await vault.connect(governor).setTokenReserveRatio(ethId, 1500);
        // firstly transfer 50 eth to strategy
        await expect(vault.connect(governor).transferToStrategy(ethId, hardhat.ethers.utils.parseUnits('50')))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(ethId, ethStrategy.address, hardhat.ethers.utils.parseUnits('50'));
        // strategy should has 50 * 10e18 shares
        expect(await wethYearn.balanceOf(ethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));

        // secondly transfer 50 eth to strategy, really transferred will be 35
        await expect(vault.connect(governor).transferToStrategy(ethId, hardhat.ethers.utils.parseUnits('50')))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(ethId, ethStrategy.address, hardhat.ethers.utils.parseUnits('35'));
        // strategy should has 85 * 10e18 shares
        expect(await wethYearn.balanceOf(ethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('85'));
    });

    it('deposit weth', async () => {
        // transfer 100 weth to vault
        // record deposit
        // reserve ratio is 0
        await weth.connect(alice).deposit({value: hardhat.ethers.utils.parseUnits('100')});
        await weth.connect(alice).transfer(vault.address, hardhat.ethers.utils.parseUnits('100'));
        await vault.recordDepositTest(wethId, hardhat.ethers.utils.parseUnits('100'));
        // transfer 50 weth to strategy
        await expect(vault.connect(governor).transferToStrategy(wethId, hardhat.ethers.utils.parseUnits('50')))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(wethId, wethStrategy.address, hardhat.ethers.utils.parseUnits('50'));
        // strategy should has 50 * 10e18 shares
        expect(await wethYearn.balanceOf(wethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));
    });

    it('deposit usdt', async () => {
        // transfer 100 usdt to vault
        // record deposit
        // reserve ratio is 0
        await usdt.mintTo(vault.address, hardhat.ethers.utils.parseUnits('100'));
        await vault.recordDepositTest(usdtId, hardhat.ethers.utils.parseUnits('100'));
        // transfer 50 usdt to strategy
        await expect(vault.connect(governor).transferToStrategy(usdtId, hardhat.ethers.utils.parseUnits('50')))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(usdtId, usdtStrategy.address, hardhat.ethers.utils.parseUnits('50'));
        // strategy should has 50 * 10e18 shares
        expect(await usdtYearn.balanceOf(usdtStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));
    });

    it('should revert when shares of vault is not enough', async () => {
        // transfer 1000 wei to vault
        await alice.sendTransaction({to:vault.address, value: 1000});
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(ethId, 500);
        // withdraw 501 wei will be fail
        await expect(vault.withdrawFromStrategyTest(ethId, 501)).to.be.revertedWith('YearnStrategy: shares not enough');
    });

    it('should revert when withdraw goal from strategy is not completed', async () => {
        // transfer 1000 wei to vault
        await usdt.mintTo(vault.address, 1000);
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(usdtId, 500);
        // simulate withdraw 500 shares and the borrower of year just return 490 wei without loss
        // after withdraw yearn weth balance = 490, totalAsset = 990, totalShares = 1000, shares really burn = 490*1000/990 = 494, value really return to vault = 490
        await usdtYearnBorrower.setSimulate(3, 490, 0);
        // withdraw 500 wei will be fail
        await expect(vault.withdrawFromStrategyTest(usdtId, 500)).to.be.revertedWith('YearnStrategy: withdraw goal not completed');
    });

    it('withdraw eth should success', async () => {
        const vaultBalance = await hardhat.ethers.provider.getBalance(vault.address);
        // transfer 1000 wei to vault
        await alice.sendTransaction({to:vault.address, value: 1000});
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(ethId, 500);
        // withdraw 500 wei will be success
        await expect(vault.withdrawFromStrategyTest(ethId, 500))
            .to.emit(ethStrategy, 'Withdraw')
            .withArgs(500, hardhat.ethers.utils.parseUnits('1'), 500, 0, 0);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(vaultBalance.add(BigNumber.from(1000)));
    });

    it('withdraw weth should success', async () => {
        const vaultBalance = await weth.balanceOf(vault.address);
        // transfer 1000 wei to vault
        await weth.connect(alice).deposit({value: 1000});
        await weth.connect(alice).transfer(vault.address, 1000);
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(wethId, 500);
        // withdraw 400 wei will be success
        await expect(vault.withdrawFromStrategyTest(wethId, 400))
            .to.emit(wethStrategy, 'Withdraw')
            .withArgs(400, hardhat.ethers.utils.parseUnits('1'), 500, 100, 0);
        expect(await weth.balanceOf(vault.address)).to.equal(vaultBalance.add(BigNumber.from(900)));
    });

    it('withdraw usdt should success', async () => {
        const vaultBalance = await usdt.balanceOf(vault.address);
        // transfer 1000 wei to vault
        await usdt.mintTo(vault.address, 1000);
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(usdtId, 500);
        // withdraw 400 wei will be success
        await usdtYearnBorrower.setSimulate(1, 400, 0);
        await expect(vault.withdrawFromStrategyTest(usdtId, 400))
            .to.emit(usdtStrategy, 'Withdraw')
            .withArgs(400, hardhat.ethers.utils.parseUnits('1'), 500, 100, 0);
        expect(await usdt.balanceOf(vault.address)).to.equal(vaultBalance.add(BigNumber.from(900)));
    });

    it('withdraw usdt without loss should success when share price > 1', async () => {
        const vaultBalance = await usdt.balanceOf(vault.address);
        // transfer 100000 wei to vault
        await usdt.mintTo(vault.address, 100000);
        // transfer 50000 wei to strategy
        await vault.connect(governor).transferToStrategy(usdtId, 50000);
        // simulate yearn has 10% earn
        await usdt.mintTo(usdtYearnBorrower.address, 5000);
        // withdraw 40000 wei will be success
        // sharesNeeded = upper(40000/1.1) = 36364
        // yearn withdraw from borrower = 36364 * 1.1 = 40000
        await usdtYearnBorrower.setSimulate(1, 40000, 0);
        await expect(vault.withdrawFromStrategyTest(usdtId, 40000))
            .to.emit(usdtStrategy, 'Withdraw')
            .withArgs(40000, hardhat.ethers.utils.parseUnits('1.1'), 50000, 13636, 0);
        expect(await usdt.balanceOf(vault.address)).to.equal(vaultBalance.add(BigNumber.from(90000)));
    });

    it('withdraw usdt without should success when share price > 1', async () => {
        const vaultBalance = await usdt.balanceOf(vault.address);
        const yearnBalance = await usdt.balanceOf(usdtYearn.address);
        // transfer 100000 wei to vault
        await usdt.mintTo(vault.address, 100000);
        // transfer 50000 wei to strategy
        await vault.connect(governor).transferToStrategy(usdtId, 50000);
        // simulate yearn has 10% earn
        await usdt.mintTo(usdtYearnBorrower.address, 5000);
        // withdraw 40000 wei will be success
        // sharesNeeded = upper(40000/1.1) = 36364
        // yearn withdraw from borrower = 36364 * 1.1 = 40000
        // borrower return to yearn 38000 and loss 3000
        // value returned from yearn = 37000 and loss 3000
        await usdtYearnBorrower.setSimulate(6, 38000, 3000);
        await expect(vault.withdrawFromStrategyTest(usdtId, 40000))
            .to.emit(usdtStrategy, 'Withdraw')
            .withArgs(40000, hardhat.ethers.utils.parseUnits('1.1'), 50000, 13636, 3000);
        expect(await usdt.balanceOf(vault.address)).to.equal(vaultBalance.add(BigNumber.from(87000)));
        expect(await usdt.balanceOf(usdtYearn.address)).to.equal(yearnBalance.add(BigNumber.from(1000)));
    });

    it('migrate should success', async () => {
        // usdt strategy prepare shares and want token
        await usdt.mintTo(vault.address, 1000);
        await vault.connect(governor).transferToStrategy(usdtId, 1000);
        await usdt.mintTo(usdtStrategy.address, 200);
        const shareBalance = await usdtYearn.balanceOf(usdtStrategy.address);
        const usdtBalance = await usdt.balanceOf(usdtStrategy.address);
        // create a same usdt strategy with usdt yearn
        const usdtStrategy2 = await strategyFactory.deploy(usdtId, usdtYearn.address);
        await vault.buildMigrateTest(usdtId, usdtStrategy.address, usdtStrategy2.address);
        // yearn strategy will migrate all shares and want token to new strategy
        // new yearn strategy will deposit all want token to yearn and get more shares
        await vault.connect(governor).migrateStrategy(usdtId);
        expect(await usdtYearn.balanceOf(usdtStrategy2.address)).to.equal(shareBalance.add(usdtBalance));
        expect(await usdt.balanceOf(usdtStrategy2.address)).to.equal(0);
    });

    it('emergency exit should success', async () => {
        // transfer 1000 wei to vault
        await alice.sendTransaction({to:vault.address, value: 1000});
        // transfer 1000 wei to strategy
        await vault.connect(governor).transferToStrategy(ethId, 1000);

        const ethBalance = await hardhat.ethers.provider.getBalance(vault.address);
        await vault.connect(governor).emergencyExit(ethId);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(ethBalance.add(BigNumber.from(1000)));
    });
});
