const hardhat = require('hardhat');
const { expect } = require('chai');

describe('ZKL unit tests', function () {
    const cap = 10000;
    let zkl,wallet,networkGovernor,lz,alice,zklInOtherChain;
    beforeEach(async () => {
        [wallet,networkGovernor,alice,zklInOtherChain] = await hardhat.ethers.getSigners();
        const dummyLZFactory = await hardhat.ethers.getContractFactory('DummyLayerZero');
        lz = await dummyLZFactory.deploy();
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        zkl = await zklFactory.deploy('ZKLINK','ZKL',cap,lz.address,networkGovernor.address,true);
        await zkl.connect(networkGovernor).setDestinations([1001],[zklInOtherChain.address]);
        await lz.setZKL(zkl.address);
    });

    it('network governor should have all token at initial chain', async () => {
        expect(await zkl.balanceOf(networkGovernor.address)).to.be.equal(cap);
    });

    it('only network governor can set bridgeable', async () => {
        await expect(zkl.connect(alice).setBridgeable(false)).to.be.revertedWith('ZKL: require governor');
        await zkl.connect(networkGovernor).setBridgeable(false);
        expect(await zkl.bridgeable()).to.be.equal(false);
    });

    it('only network governor can set destination', async () => {
        await expect(zkl.connect(alice).setDestination(1001, zklInOtherChain.address)).to.be.revertedWith('ZKL: require governor');
        await zkl.connect(networkGovernor).setDestination(1001, alice.address);
        expect(await zkl.destination(1001)).to.be.equal(alice.address.toLowerCase());
    });

    it('bridge should success', async () => {
        await zkl.connect(networkGovernor).transfer(alice.address, 500);
        await zkl.connect(networkGovernor).setBridgeable(false);
        await expect(zkl.connect(alice).bridge(1001, alice.address, 100)).to.be.revertedWith('ZKL: bridge disabled');

        await zkl.connect(networkGovernor).setBridgeable(true);
        await expect(zkl.connect(alice).bridge(1002, alice.address, 100)).to.be.revertedWith('ZKL: invalid lz chain id');

        await expect(zkl.connect(alice).bridge(1001, alice.address, 100, {value:1})).to.be
            .emit(zkl, 'BridgeTo')
            .withArgs(1001, alice.address.toLowerCase(), 100);
        expect(await zkl.totalSupply()).to.be.equal(cap-100);
        expect(await zkl.balanceOf(alice.address)).to.be.equal(500-100);
    });

    it('receive bridge token should success', async () => {
        await expect(zkl.connect(alice).lzReceive(1001, alice.address, 0, [])).to.be.revertedWith('ZKL: require LZ endpoint');

        await zkl.connect(networkGovernor).transfer(alice.address, 500);
        await zkl.connect(alice).bridge(1001, alice.address, 100, {value:1});

        await expect(lz.lzReceive(1001, zklInOtherChain.address, 1, alice.address, 50)).to.be
            .emit(zkl, 'BridgeFrom')
            .withArgs(1001, alice.address, 50);
        await expect(lz.lzReceive(1001, zklInOtherChain.address, 2, alice.address, 30)).to.be
            .emit(zkl, 'BridgeFrom')
            .withArgs(1001, alice.address, 30);
    });
});
