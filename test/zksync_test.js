const hardhat = require('hardhat');
const { expect } = require('chai');
const {writeDepositPubdata} = require('./utils');

describe('ZkSync unit tests', function () {
    const tokenA = "0xe4815AE53B124e7263F08dcDBBB757d41Ed658c6";
    const tokenB = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const tokenC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    let zkSync, zkSyncBlock, uniswapV2, vault;
    let wallet,alice,bob;
    let tokenD;
    beforeEach(async () => {
        [wallet,alice,bob] = await hardhat.ethers.getSigners();
        // tokenD
        const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
        tokenD = await erc20Factory.deploy(10000);
        // governance, alice is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        await governance.connect(alice).addToken(tokenA); // tokenId = 1
        await governance.connect(alice).addToken(tokenB); // tokenId = 2
        await governance.connect(alice).addToken(tokenD.address); // tokenId = 3
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // UniswapV2Factory
        const uniswapV2Factory = await hardhat.ethers.getContractFactory('UniswapV2Factory');
        uniswapV2 = await uniswapV2Factory.deploy();
        // Vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        vault = await vaultFactory.deploy();
        await vault.initialize(hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governance.address]));
        // ZkSync
        const contractFactory = await hardhat.ethers.getContractFactory('ZkSyncTest');
        zkSync = await contractFactory.deploy();
        // ZkSyncCommitBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlock');
        const zkSyncBlockRaw = await zkSyncBlockFactory.deploy();
        zkSyncBlock = zkSyncBlockFactory.attach(zkSync.address);
        await zkSync.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                [governance.address, verifier.address, zkSyncBlockRaw.address, uniswapV2.address, vault.address, hardhat.ethers.utils.arrayify("0x209d742ecb062db488d20e7f8968a40673d718b24900ede8035e05a78351d956")])
        );
        await uniswapV2.setZkSyncAddress(zkSync.address);
        await vault.setZkSyncAddress(zkSync.address);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.createPair(tokenA, tokenB)).to.be.revertedWith("L");
        await expect(zkSync.createETHPair(tokenA)).to.be.revertedWith("L");
        await expect(zkSync.depositETH(wallet.address)).to.be.revertedWith("L");
        await expect(zkSync.depositERC20(tokenA, 100, wallet.address)).to.be.revertedWith("L");
        await expect(zkSync.requestFullExit(1, tokenA)).to.be.revertedWith("L");
    });

    it('should revert when sender is not network governance', async () => {
        await expect(zkSync.connect(bob).createPair(tokenA, tokenB)).to.be.revertedWith("1g");
        await expect(zkSync.connect(bob).createETHPair(tokenA)).to.be.revertedWith("1g");
    });

    it('should revert if token not added when create pair', async () => {
        await expect(zkSync.connect(alice).createPair(tokenA, tokenC)).to.be.revertedWith("1i");
        await expect(zkSync.connect(alice).createETHPair(tokenC)).to.be.revertedWith("1i");
    });

    it('create pair should success', async () => {
        await expect(zkSync.connect(alice).createPair(tokenA, tokenB)).to.emit(zkSync, 'CreatePair');
        expect(await zkSync.firstPriorityRequestId()).equal(0);
        expect(await zkSync.totalOpenPriorityRequests()).equal(1);
        await expect(zkSync.connect(alice).createETHPair(tokenA)).to.emit(zkSync, 'CreatePair');
        expect(await zkSync.firstPriorityRequestId()).equal(0);
        expect(await zkSync.totalOpenPriorityRequests()).equal(2);
    });

    it('deposit and withdraw eth should success', async () => {
        await expect(zkSync.connect(bob).depositETH(wallet.address, {value:30})).to
            .emit(zkSync, 'Deposit')
            .withArgs(0, 30);
        let contractBalance = await hardhat.ethers.provider.getBalance(vault.address);
        expect(contractBalance).equal(30);

        await zkSync.setBalancesToWithdraw(alice.address, 0, 10);
        expect(await zkSync.getPendingBalance(alice.address, hardhat.ethers.constants.AddressZero)).equal(10);

        await expect(zkSync.connect(alice).withdrawPendingBalance(alice.address, hardhat.ethers.constants.AddressZero, 10, 0)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(0, 10);
        expect(await hardhat.ethers.provider.getBalance(vault.address)).equal(contractBalance.sub(10));
    });

    it('deposit and withdraw non lp erc20 should success', async () => {
        let senderBalance = await tokenD.balanceOf(wallet.address);
        let contractBalance = await tokenD.balanceOf(vault.address);
        await tokenD.approve(zkSync.address, 100);
        await expect(zkSync.depositERC20(tokenD.address, 30, alice.address)).to
            .emit(zkSync, 'Deposit')
            .withArgs(3, 30);
        expect(await tokenD.balanceOf(vault.address)).equal(contractBalance.add(30));
        expect(await tokenD.balanceOf(wallet.address)).equal(senderBalance.sub(30));

        await zkSync.setBalancesToWithdraw(alice.address, 3, 10);
        expect(await zkSync.getPendingBalance(alice.address, tokenD.address)).equal(10);

        await expect(zkSync.connect(alice).withdrawPendingBalance(alice.address, tokenD.address, 10, 0)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(3, 10);
        expect(await tokenD.balanceOf(vault.address)).equal(contractBalance.add(20));
        expect(await tokenD.balanceOf(alice.address)).equal(10);
    });

    it('deposit and withdraw lp erc20 should success', async () => {
        await zkSync.connect(alice).createPair(tokenA, tokenB); // the first lp token id = 128
        let pairAddress = await uniswapV2.getPair(tokenA, tokenB);
        await zkSync.pairMint(pairAddress, wallet.address, 100);
        const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
        const pairToken = erc20Factory.attach(pairAddress);
        let senderBalance = await pairToken.balanceOf(wallet.address);
        let contractBalance = await pairToken.balanceOf(zkSync.address);
        await pairToken.approve(zkSync.address, 100);
        await expect(zkSync.depositERC20(pairToken.address, 30, alice.address)).to
            .emit(zkSync, 'Deposit')
            .withArgs(128, 30);
        expect(await pairToken.balanceOf(zkSync.address)).equal(contractBalance);
        expect(await pairToken.balanceOf(wallet.address)).equal(senderBalance.sub(30));

        await zkSync.setBalancesToWithdraw(alice.address, 128, 10);
        expect(await zkSync.getPendingBalance(alice.address, pairAddress)).equal(10);

        await expect(zkSync.connect(alice).withdrawPendingBalance(alice.address, pairAddress, 10, 0)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(128, 10);
        expect(await pairToken.balanceOf(zkSync.address)).equal(contractBalance);
        expect(await pairToken.balanceOf(alice.address)).equal(10);
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        // require exodus mode
        await expect(zkSync.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("8");

        // no deposits to process
        await zkSync.setExodusMode(true);
        await expect(zkSync.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("9");

        await zkSync.setExodusMode(false);
        await zkSync.connect(bob).depositETH(wallet.address, {value:30});
        await zkSync.connect(bob).depositETH(wallet.address, {value:20});

        const tokenId = '0x0000';
        const amount0 = '0x0000000000000000000000000000001e';
        const amount1 = '0x00000000000000000000000000000014';
        const owner = wallet.address;
        const pubdata0 = writeDepositPubdata({ tokenId, amount:amount0, owner });
        const pubdata1 = writeDepositPubdata({ tokenId, amount:amount1, owner });

        await zkSync.setExodusMode(true);
        await zkSync.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
        await expect(zkSync.connect(wallet).withdrawPendingBalance(wallet.address, hardhat.ethers.constants.AddressZero, 50, 0)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(0, 50);
    });

    it('requestFullExit should success', async () => {
        // account id can not over limit
        const MAX_ACCOUNT_ID = (2**24) - 1;
        await expect(zkSync.requestFullExit(MAX_ACCOUNT_ID + 1, tokenA)).to.be.revertedWith("e");

        await expect(zkSync.connect(wallet).requestFullExit(1, tokenA)).to
            .emit(zkSync, 'NewPriorityRequest');
    });

    it('fallback to zkSyncBlock should success', async () => {
        await zkSyncBlock.activateExodusMode();
    });
});
