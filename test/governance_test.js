const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Governance unit tests', function () {
    let testContract;
    let alice, bob, jack, lzBridgeInETH;
    before(async () => {
        [alice, bob, jack, lzBridgeInETH] = await hardhat.ethers.getSigners();
        const contractFactory = await hardhat.ethers.getContractFactory('Governance');
        testContract = await contractFactory.connect(alice).deploy();
        await testContract.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        expect(await testContract.networkGovernor()).to.equal(alice.address);
    });

    it('Change governance should success', async () => {
        await testContract.connect(alice).changeGovernor(bob.address);
        expect(await testContract.networkGovernor()).to.equal(bob.address);

        await expect(testContract.connect(bob).changeGovernor(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('Governor not set');
    });

    it('Add token should success', async () => {
        const tokenId = 1;
        const tokenAddress = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        await expect(testContract.connect(jack).addToken(tokenId, tokenAddress)).to.be.revertedWith("Caller is not governor");

        await expect(testContract.connect(bob).addToken(0, tokenAddress)).to.be.revertedWith("Invalid token id");
        await expect(testContract.connect(bob).addToken(8192, tokenAddress)).to.be.revertedWith("Invalid token id");
        await expect(testContract.connect(bob).addToken(tokenId, hardhat.ethers.constants.AddressZero)).to.be.revertedWith("Token address not set");

        await testContract.connect(bob).addToken(tokenId, tokenAddress);
        const rt = await testContract.getToken(tokenId);
        expect(rt.registered).equal(true);
        expect(rt.paused).equal(false);
        expect(rt.tokenAddress).equal(tokenAddress);
        expect(await testContract.getTokenId(tokenAddress)).to.eq(tokenId);

        // duplicate register
        await expect(testContract.connect(bob).addToken(tokenId, tokenAddress)).to.be.revertedWith('Token registered');
        const anotherTokenId = 2;
        await expect(testContract.connect(bob).addToken(anotherTokenId, tokenAddress)).to.be.revertedWith('Token registered');
    });

    it('Set token pause should success', async () => {
        const tokenId = 1;
        await expect(testContract.connect(jack).setTokenPaused(tokenId, true)).to.be.revertedWith("Caller is not governor");
        await expect(testContract.connect(bob).setTokenPaused(2, true)).to.be.revertedWith("Token not registered");

        expect(await testContract.connect(bob).setTokenPaused(tokenId, true))
            .to.be.emit(testContract.address, 'TokenPausedUpdate');
        const rt = await testContract.getToken(tokenId);
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
            .to.be.revertedWith('Caller is not governor');

        await expect(testContract.connect(bob).addBridge(lzBridgeInETH.address))
            .to.be.emit(testContract, "AddBridge")
            .withArgs(lzBridgeInETH.address);
        // duplicate add bridge should failed
        await expect(testContract.connect(bob).addBridge(lzBridgeInETH.address))
            .to.be.revertedWith("Bridge exist");
    });

    it('only network governor can disable bridge', async () => {
        await expect(testContract.connect(alice).updateBridge(1, false, false))
            .to.be.revertedWith('Caller is not governor');

        await expect(testContract.connect(bob).updateBridge(0, false, false))
            .to.be.emit(testContract, "UpdateBridge")
            .withArgs(0, false, false);

        await expect(testContract.connect(bob).updateBridge(0, true, true))
            .to.be.emit(testContract, "UpdateBridge")
            .withArgs(0, true, true);
    });
});
