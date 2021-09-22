const hardhat = require('hardhat');
const { expect } = require('chai');
const {writeDepositPubdata, getQuickSwapPubdata, calFee} = require('./utils');

describe('Quick swap unit tests', function () {
    let token, zkSync, zkSyncBlock, zkSyncExit, governance, vault;
    let wallet,alice,bob;
    beforeEach(async () => {
        [wallet,alice,bob] = await hardhat.ethers.getSigners();
        // token
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        token = await erc20Factory.deploy(10000);
        // governance, alice is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        await governance.connect(alice).addToken(token.address, false); // tokenId = 1
        await governance.connect(alice).setValidator(bob.address, true); // set bob as validator
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // Vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        vault = await vaultFactory.deploy();
        await vault.initialize(hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governance.address]));
        // ZkSync
        const contractFactory = await hardhat.ethers.getContractFactory('ZkSyncTest');
        zkSync = await contractFactory.deploy();
        // ZkSyncCommitBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlockTest');
        const zkSyncBlockRaw = await zkSyncBlockFactory.deploy();
        zkSyncBlock = zkSyncBlockFactory.attach(zkSync.address);
        // ZkSyncExit
        const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkSyncExit');
        const zkSyncExitRaw = await zkSyncExitFactory.deploy();
        zkSyncExit = zkSyncExitFactory.attach(zkSync.address);
        await zkSync.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                [governance.address, verifier.address, vault.address, zkSyncBlockRaw.address, zkSyncExitRaw.address, hardhat.ethers.utils.arrayify("0x1b06adabb8022e89da0ddb78157da7c57a5b7356ccc9ad2f51475a4bb13970c6")])
        );
        await vault.setZkSyncAddress(zkSync.address);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.swapExactETHForTokens(wallet.address, 0, 0, 1, 1, wallet.address, 0)).to.be.revertedWith("L");
        await expect(zkSync.swapExactTokensForTokens(wallet.address, 1, 0, 0, token.address, 1, 1, wallet.address, 0)).to.be.revertedWith("L");
    });

    it('quick swap eth should success', async () => {
        const amountIn = hardhat.ethers.utils.parseEther("1");
        const amountOutMin = hardhat.ethers.utils.parseEther("3000");
        const withdrawFee = 3;
        const toChainId = 1;
        const toTokenId = 1;
        const to = bob.address;
        await zkSync.connect(bob).swapExactETHForTokens(bob.address, amountOutMin, withdrawFee, toChainId, toTokenId, to, 0,{value:amountIn});
        let contractBalance = await hardhat.ethers.provider.getBalance(vault.address);
        expect(contractBalance).equal(amountIn);
    });

    it('quick swap erc20 should success', async () => {
        const amountIn = hardhat.ethers.utils.parseEther("1");
        const amountOutMin = hardhat.ethers.utils.parseEther("3000");
        const withdrawFee = 3;
        const toChainId = 1;
        const toTokenId = 1;
        const to = bob.address;
        await token.connect(bob).mint(amountIn);
        await token.connect(bob).approve(zkSync.address, amountIn);
        await zkSync.connect(bob).swapExactTokensForTokens(bob.address, amountIn, amountOutMin, withdrawFee, token.address, toChainId, toTokenId, to, 0);
        expect(await token.balanceOf(vault.address)).equal(amountIn);
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        await zkSync.connect(bob).depositETH(bob.address, {value:30});
        await zkSync.connect(bob).swapExactETHForTokens(bob.address, 0, 0, 1, 1, bob.address, 0, {value:20});

        const tokenId = '0x0000';
        const amount = '0x0000000000000000000000000000001e';
        const owner = bob.address;
        const pubdata0 = writeDepositPubdata({ tokenId, amount, owner });

        const fromChainId = '0x00';
        const toChainId = '0x01';
        const toTokenId = '0x0001';
        const amountIn = '0x00000000000000000000000000000014';
        const amountOutMin = '0x00000000000000000000000000000000';
        const withdrawFee = '0x0000';
        const nonce = '0x00000000';
        const pubdata1 = getQuickSwapPubdata({ fromChainId, toChainId, owner, fromTokenId:tokenId, amountIn, to:bob.address, toTokenId, amountOutMin, withdrawFee, nonce});
        await zkSync.setExodusMode(true);
        await zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
        await expect(zkSyncExit.connect(bob).withdrawPendingBalance(bob.address, hardhat.ethers.constants.AddressZero, 50)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(0, 50);
    });

    it('accept eth should success', async () => {
        const opType = 12;
        const fromChainId = 1;
        const toChainId = 0;
        const fromTokenId = 0;
        const toTokenId = 0;
        const accepter = alice.address;
        const receiver = bob.address;
        const nonce = 0;
        await expect(zkSyncExit.accept(accepter, receiver, toTokenId, 0, 0, nonce)).to.be.revertedWith("ZkSync: amountReceive");
        await expect(zkSyncExit.accept(accepter, receiver, toTokenId, 100, 10000, nonce)).to.be.revertedWith("ZkSync: amountReceive");

        let amount = hardhat.ethers.utils.parseEther("1");
        let withdrawFee = 30; // 0.3%
        let bobReceive = hardhat.ethers.utils.parseEther("0.997");
        await zkSync.connect(bob).swapExactETHForTokens(bob.address, amount, withdrawFee, toChainId, toTokenId, bob.address, nonce, {value:amount});

        await expect(zkSyncExit.connect(alice).accept(accepter, receiver, toTokenId, amount, withdrawFee, 0, {value:hardhat.ethers.utils.parseEther("0.996")})).to.be.revertedWith("ZkSync: accept msg value");
        let aliceBalance0 = await alice.getBalance();
        let bobBalance0 = await bob.getBalance();
        let tx = await zkSyncExit.connect(alice).accept(accepter, receiver, toTokenId, amount, withdrawFee, 0, {value:hardhat.ethers.utils.parseEther("1")});
        let txFee = await calFee(tx);
        let aliceBalance1 = await alice.getBalance();
        let bobBalance1 = await bob.getBalance();
        expect(aliceBalance1).to.eq(aliceBalance0.sub(bobReceive).sub(txFee));
        expect(bobBalance1).to.eq(bobBalance0.add(bobReceive));

        const encodePubdata = hardhat.ethers.utils.solidityPack(["uint8","uint8","uint8","address","uint16","uint128","address","uint16","uint128","uint16","uint32"],
            [opType,fromChainId,toChainId,bob.address,fromTokenId,amount,bob.address,toTokenId,amount,withdrawFee,nonce]);
        const pubdata = ethers.utils.arrayify(encodePubdata);
        await zkSyncBlock.testExecQuickSwap(pubdata);
        let alicePendingBalance = await zkSyncExit.getPendingBalance(accepter, hardhat.ethers.constants.AddressZero);
        expect(alicePendingBalance).to.eq(amount);
    });

    it('accept erc20 token should success', async () => {
        const opType = 12;
        const fromChainId = 1;
        const toChainId = 0;
        const fromTokenId = 1;
        const toTokenId = 1;
        const accepter = alice.address;
        const receiver = bob.address;
        const nonce = 134;

        let amount = hardhat.ethers.utils.parseEther("1000");
        let withdrawFee = 30; // 0.3%
        let bobReceive = hardhat.ethers.utils.parseEther("997");
        let fee = hardhat.ethers.utils.parseEther("3");

        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await zkSync.connect(bob).swapExactTokensForTokens(bob.address, amount, amount, withdrawFee, token.address, toChainId, toTokenId, bob.address, nonce);

        await token.connect(alice).mint(amount);
        let aliceBalance0 = await token.balanceOf(alice.address);
        let bobBalance0 = await token.balanceOf(bob.address);

        await token.connect(alice).approve(zkSync.address, amount);
        await expect(zkSyncExit.connect(alice).accept(accepter, receiver, toTokenId, amount, withdrawFee, nonce))
            .to.emit(zkSync, 'Accept')
            .withArgs(accepter, receiver, toTokenId, amount, fee, nonce);

        let aliceBalance1 = await token.balanceOf(alice.address);
        let bobBalance1 = await token.balanceOf(bob.address);
        expect(aliceBalance1).to.eq(aliceBalance0.sub(bobReceive));
        expect(bobBalance1).to.eq(bobBalance0.add(bobReceive));

        const encodePubdata = hardhat.ethers.utils.solidityPack(["uint8","uint8","uint8","address","uint16","uint128","address","uint16","uint128","uint16","uint32"],
            [opType,fromChainId,toChainId,bob.address,fromTokenId,amount,bob.address,toTokenId,amount,withdrawFee,nonce]);
        const pubdata = ethers.utils.arrayify(encodePubdata);
        await zkSyncBlock.testExecQuickSwap(pubdata);
        let alicePendingBalance = await zkSyncExit.getPendingBalance(accepter, token.address);
        expect(alicePendingBalance).to.eq(amount);
    });
});
