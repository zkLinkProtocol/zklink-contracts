const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Governance unit tests', function () {
    let testContract;
    let alice, bob, jack, lzBridgeInETH;
    before(async () => {
        [alice, bob, jack, lzBridgeInETH] = await hardhat.ethers.getSigners();
        const contractFactory = await hardhat.ethers.getContractFactory('ZkLinkPeripheryTest');
        testContract = await contractFactory.connect(alice).deploy();
        await testContract.setGovernor(alice.address);

        expect(await testContract.networkGovernor()).to.equal(alice.address);
    });

    it('Change governance should success', async () => {
        await testContract.connect(alice).changeGovernor(bob.address);
        expect(await testContract.networkGovernor()).to.equal(bob.address);

        await expect(testContract.connect(bob).changeGovernor(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('H');
    });

    it('Add token should success', async () => {
        const tokenId = 1;
        const tokenAddress = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        await expect(testContract.connect(jack).addToken(tokenId, tokenAddress, true)).to.be.revertedWith("3");

        await expect(testContract.connect(bob).addToken(0, tokenAddress, true)).to.be.revertedWith("I0");
        await expect(testContract.connect(bob).addToken(8192, tokenAddress, true)).to.be.revertedWith("I0");
        await expect(testContract.connect(bob).addToken(tokenId, hardhat.ethers.constants.AddressZero, true)).to.be.revertedWith("I1");

        await testContract.connect(bob).addToken(tokenId, tokenAddress, true);
        const rt = await testContract.tokens(tokenId);
        expect(rt.registered).equal(true);
        expect(rt.paused).equal(false);
        expect(rt.standard).equal(true);
        expect(rt.tokenAddress).equal(tokenAddress);
        expect(await testContract.tokenIds(tokenAddress)).to.eq(tokenId);

        // duplicate register
        await expect(testContract.connect(bob).addToken(tokenId, tokenAddress, true)).to.be.revertedWith('I2');
        const anotherTokenId = 2;
        await expect(testContract.connect(bob).addToken(anotherTokenId, tokenAddress, true)).to.be.revertedWith('I2');
    });

    it('Set token pause should success', async () => {
        const tokenId = 1;
        await expect(testContract.connect(jack).setTokenPaused(tokenId, true)).to.be.revertedWith("3");
        await expect(testContract.connect(bob).setTokenPaused(2, true)).to.be.revertedWith("K");

        expect(await testContract.connect(bob).setTokenPaused(tokenId, true))
            .to.be.emit(testContract.address, 'TokenPausedUpdate');
        const rt = await testContract.tokens(tokenId);
        expect(rt.paused).equal(true);
    });

    it('Set validator should success', async () => {
        await expect(testContract.connect(bob).setValidator(jack.address, true))
            .to.emit(testContract, 'ValidatorStatusUpdate')
            .withArgs(jack.address, true);

        await expect(testContract.connect(bob).setValidator(jack.address, false))
            .to.emit(testContract, 'ValidatorStatusUpdate')
            .withArgs(jack.address, false);
    });

    it('only network governor can add bridge', async () => {
        await expect(testContract.connect(alice).addBridge(lzBridgeInETH.address))
            .to.be.revertedWith('3');

        await expect(testContract.connect(bob).addBridge(lzBridgeInETH.address))
            .to.be.emit(testContract, "AddBridge")
            .withArgs(lzBridgeInETH.address);
        // duplicate add bridge should failed
        await expect(testContract.connect(bob).addBridge(lzBridgeInETH.address))
            .to.be.revertedWith("L1");
    });

    it('only network governor can disable bridge', async () => {
        await expect(testContract.connect(alice).updateBridge(1, false, false))
            .to.be.revertedWith('3');

        await expect(testContract.connect(bob).updateBridge(0, false, false))
            .to.be.emit(testContract, "UpdateBridge")
            .withArgs(0, false, false);

        await expect(testContract.connect(bob).updateBridge(0, true, true))
            .to.be.emit(testContract, "UpdateBridge")
            .withArgs(0, true, true);
    });
});
