const hardhat = require('hardhat');
const constants = hardhat.ethers.constants;
const { expect } = require('chai');

describe('Proxy unit tests', function () {
    let testContract;
    let dummyProxy;
    let alice, bob;
    before(async () => {
        [alice, bob] = await hardhat.ethers.getSigners();
        const dummyFactory = await hardhat.ethers.getContractFactory('DummyFirst');
        const dummyFirst = await dummyFactory.deploy();
        const testFactory = await hardhat.ethers.getContractFactory('Proxy');
        testContract = await testFactory.connect(alice).deploy(dummyFirst.address, [1, 2]);
        dummyProxy = await hardhat.ethers.getContractAt('DummyTarget', testContract.address);
    });

    it('check delegatecall', async () => {
        expect(await dummyProxy.get_DUMMY_INDEX()).to.equal(1);
    });

    it('checking that requireMaster calls present', async () => {
        await expect(testContract.connect(bob).upgradeTarget(constants.AddressZero)).to.be.revertedWith('1c');
    });

    it('checking Proxy reverts', async () => {
        await expect(testContract.connect(alice).initialize([])).to.be.revertedWith('ini11');
    });

    it('upgrade to the current target should success', async () => {
        const currentTarget = await testContract.getTarget();
        await testContract.connect(alice).upgradeTarget(currentTarget);
        expect(await dummyProxy.get_DUMMY_INDEX()).to.equal(1);
    });

    it('upgrade to new target should success', async () => {
        const dummyFactory = await hardhat.ethers.getContractFactory('DummySecond');
        const dummySecond = await dummyFactory.deploy();
        await testContract.connect(alice).upgradeTarget(dummySecond.address);
        expect(await dummyProxy.get_DUMMY_INDEX()).to.equal(2);
    });
});
