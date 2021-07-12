const hardhat = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');

describe('CoinwindStrategy unit tests', function () {
    let vault;
    let deployer, governor, alice;
    const ethId = 0;
    let weth, wethId;
    let usdt, usdtId;
    let cow, cowId;
    let mdx, mdxId;
    let coinwind;
    let strategyFactory;
    let ethStrategy, wethStrategy, usdtStrategy;

    beforeEach(async () => {
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
        await vault.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'],
                [governance.address])
        );
        // weth
        const wethFactory = await hardhat.ethers.getContractFactory('WETH');
        weth = await wethFactory.deploy();
        await governance.connect(governor).addToken(weth.address);
        wethId = await governance.validateTokenAddress(weth.address);
        // usdt
        const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
        usdt = await erc20Factory.deploy(0);
        await governance.connect(governor).addToken(usdt.address);
        usdtId = await governance.validateTokenAddress(usdt.address);
        // cow
        cow = await erc20Factory.deploy(0);
        await governance.connect(governor).addToken(cow.address);
        cowId = await governance.validateTokenAddress(cow.address);
        // mdx
        mdx = await erc20Factory.deploy(0);
        await governance.connect(governor).addToken(mdx.address);
        mdxId = await governance.validateTokenAddress(mdx.address);
        // coinwind
        const coinwindFactory = await hardhat.ethers.getContractFactory('MockCoinwind');
        coinwind = await coinwindFactory.deploy(cow.address, mdx.address);
        await coinwind.addPool(weth.address); // pid 0
        await coinwind.addPool(usdt.address); // pid 1
        // coinwind strategy
        strategyFactory = await hardhat.ethers.getContractFactory('CoinwindStrategyTest');
        ethStrategy = await strategyFactory.deploy(ethId, 0, coinwind.address, vault.address, weth.address, cow.address, mdx.address);
        await ethStrategy.initWantToken();
        wethStrategy = await strategyFactory.deploy(wethId, 0, coinwind.address, vault.address, weth.address, cow.address, mdx.address);
        await wethStrategy.initWantToken();
        usdtStrategy = await strategyFactory.deploy(usdtId, 1, coinwind.address, vault.address, weth.address, cow.address, mdx.address);
        await usdtStrategy.initWantToken();
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

    it('no deposit', async () => {
        expect(await usdtStrategy.wantNetValue()).to.equal(0);

        await usdt.mintTo(usdtStrategy.address, 1000);
        expect(await usdtStrategy.wantNetValue()).to.equal(1000);
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
        // strategy deposited 50 eth
        expect(await coinwind.getDepositAsset(weth.address, ethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));

        // secondly transfer 50 eth to strategy, really transferred will be 35
        await expect(vault.connect(governor).transferToStrategy(ethId, hardhat.ethers.utils.parseUnits('50')))
            .to.emit(vault, 'TransferToStrategy')
            .withArgs(ethId, ethStrategy.address, hardhat.ethers.utils.parseUnits('35'));
        // strategy deposited 85 eth
        expect(await coinwind.getDepositAsset(weth.address, ethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('85'));
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
        // strategy deposited 50 eth
        expect(await coinwind.getDepositAsset(weth.address, wethStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));
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
        // strategy deposited 50 eth
        expect(await coinwind.getDepositAsset(usdt.address, usdtStrategy.address)).to.equal(hardhat.ethers.utils.parseUnits('50'));
    });

    it('should revert when deposited asset of vault is not enough', async () => {
        // transfer 1000 wei to vault
        await alice.sendTransaction({to:vault.address, value: 1000});
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(ethId, 500);
        // withdraw 501 wei will be fail
        await expect(vault.withdrawFromStrategyTest(ethId, 501)).to.be.revertedWith('CoinwindStrategy: deposited asset not enough');
    });

    it('withdraw eth should success', async () => {
        // transfer 1000 wei to vault
        await alice.sendTransaction({to:vault.address, value: 1000});
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(ethId, 500);
        // withdraw 500 wei will be success
        await expect(vault.withdrawFromStrategyTest(ethId, 500))
            .to.emit(ethStrategy, 'Withdraw')
            .withArgs(500, 500, 0, 0);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).to.equal(1000);
    });

    it('withdraw weth should success', async () => {
        // transfer 1000 wei to vault
        await weth.connect(alice).deposit({value: 1000});
        await weth.connect(alice).transfer(vault.address, 1000);
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(wethId, 500);
        // withdraw 400 wei will be success
        await expect(vault.withdrawFromStrategyTest(wethId, 400))
            .to.emit(wethStrategy, 'Withdraw')
            .withArgs(400, 500, 100, 0);
        expect(await weth.balanceOf(vault.address)).to.equal(900);
    });

    it('withdraw usdt should success', async () => {
        // transfer 1000 wei to vault
        await usdt.mintTo(vault.address, 1000);
        // transfer 500 wei to strategy
        await vault.connect(governor).transferToStrategy(usdtId, 500);
        // withdraw 400 wei will be success
        await expect(vault.withdrawFromStrategyTest(usdtId, 400))
            .to.emit(usdtStrategy, 'Withdraw')
            .withArgs(400, 500, 100, 0);
        expect(await usdt.balanceOf(vault.address)).to.equal(900);
    });

    it('harvest should success', async () => {
        // add penging reward
        await coinwind.addPendingReward(cow.address, ethStrategy.address, 100);
        await coinwind.addPendingReward(mdx.address, ethStrategy.address, 200);
        // harvest will get all pending reward
        await vault.connect(governor).harvest(ethId);
        expect(await cow.balanceOf(vault.address)).to.equal(100);
        expect(await mdx.balanceOf(vault.address)).to.equal(200);
    });

    it('migrate should success', async () => {
        // usdt strategy prepare shares and want token
        await usdt.mintTo(vault.address, 1000);
        await vault.connect(governor).transferToStrategy(usdtId, 1000);
        await usdt.mintTo(usdtStrategy.address, 200);
        const deposited = await coinwind.getDepositAsset(usdt.address, usdtStrategy.address);
        const usdtBalance = await usdt.balanceOf(usdtStrategy.address);
        // create a same usdt strategy with usdt yearn
        const usdtStrategy2 = await strategyFactory.deploy(usdtId, 1, coinwind.address, vault.address, weth.address, cow.address, mdx.address);
        await usdtStrategy2.initWantToken();
        await vault.buildMigrateTest(usdtId, usdtStrategy.address, usdtStrategy2.address);
        // coinwind strategy will migrate all want token to new strategy
        // new coinwind strategy will deposit all want token to coinwind
        await vault.connect(governor).migrateStrategy(usdtId);
        expect(await coinwind.getDepositAsset(usdt.address, usdtStrategy2.address)).to.equal(deposited.add(usdtBalance));
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
