const hardhat = require('hardhat');
const { expect } = require('chai');

describe('ZKL unit tests', function () {
    let zkl,wallet,networkGovernor,zkLink,alice;
    beforeEach(async () => {
        [wallet,networkGovernor,zkLink,alice] = await hardhat.ethers.getSigners();
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        zkl = await zklFactory.deploy('ZKLINK','ZKL',10000,networkGovernor.address,zkLink.address);
    });

    it('only address with MINTER_ROLE can mine', async () => {
        await expect(zkl.connect(alice).mint(alice.address, 100)).to.be.reverted;
        await expect(zkl.connect(networkGovernor).mint(alice.address, 100)).to.be
            .emit(zkl, 'Transfer')
            .withArgs('0x0000000000000000000000000000000000000000', alice.address, 100);
        await expect(zkl.connect(zkLink).mint(alice.address, 100)).to.be
            .emit(zkl, 'Transfer')
            .withArgs('0x0000000000000000000000000000000000000000', alice.address, 100);
    });

    it('mine can not over cap', async () => {
        await zkl.connect(zkLink).mint(alice.address, 1000);
        await expect(zkl.connect(zkLink).mint(alice.address, 9001)).to.be.revertedWith('ERC20Capped: cap exceeded');
    });
});
