const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Governance unit tests', function () {
    let testContract;
    let alice, bob, jack;
    before(async () => {
        [alice, bob, jack] = await hardhat.ethers.getSigners();
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

        await expect(testContract.connect(bob).changeGovernor(hardhat.ethers.constants.AddressZero)).to.be.revertedWith('z0');
    });

    it('Add token should success', async () => {
        const token = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        await expect(testContract.connect(jack).addToken(token)).to.be.reverted;

        await testContract.connect(bob).addToken(token);
        const totalTokens = await testContract.totalTokens();
        const tid = await testContract.tokenIds(token);
        const taddr = await testContract.tokenAddresses(tid);
        expect(totalTokens).equal(1);
        expect(tid).equal(1);
        expect(taddr).equal(token);

        await expect(testContract.connect(bob).addToken(token)).to.be.revertedWith('1e');
    });

    it('Set validator should success', async () => {
        await expect(testContract.connect(bob).setValidator(jack.address, true))
            .to.emit(testContract, 'ValidatorStatusUpdate')
            .withArgs(jack.address, true);

        await expect(testContract.connect(bob).setValidator(jack.address, false))
            .to.emit(testContract, 'ValidatorStatusUpdate')
            .withArgs(jack.address, false);
    });

    it('Change nft should success', async () => {
        const nftFactory = await hardhat.ethers.getContractFactory('ZkLinkNFT');
        const newNft = await nftFactory.deploy(hardhat.ethers.constants.AddressZero);

        await expect(testContract.connect(bob).changeNft(newNft.address)).to
            .emit(testContract, 'NftUpdate')
            .withArgs(newNft.address);
    });
});
