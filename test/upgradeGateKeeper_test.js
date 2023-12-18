const hardhat = require('hardhat');
const constants = hardhat.ethers.constants;
const { expect } = require('chai');
const { performance } = require('perf_hooks');
const { encodeBytes32String } = require("ethers")

// some random constants for checking write and read from storage
const bytes = encodeBytes32String('[133, 174, 97, 255]');

describe('UpgradeGatekeeper unit tests', function () {
    let provider;
    let wallet;
    let proxyTestContract, proxyDummyInterface;
    let dummyFirst, dummySecond;
    let upgradeGatekeeperContract;
    before(async () => {
        provider = hardhat.ethers.provider;
        const wallets = await hardhat.ethers.getSigners();
        // Get some wallet different from than the default one.
        wallet = wallets[1];

        const dummy1Factory = await hardhat.ethers.getContractFactory('DummyFirst');
        dummyFirst = await dummy1Factory.deploy();
        const dummy2Factory = await hardhat.ethers.getContractFactory('DummySecond');
        dummySecond = await dummy2Factory.deploy();

        const proxyFactory = await hardhat.ethers.getContractFactory('Proxy');
        proxyTestContract = await proxyFactory.deploy(dummyFirst.target, encodeBytes32String('[0,1]'));

        proxyDummyInterface = await hardhat.ethers.getContractAt('DummyTarget', proxyTestContract.target);

        const upgradeGatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
        upgradeGatekeeperContract = await upgradeGatekeeperFactory.deploy(proxyTestContract.target);

        await proxyTestContract.transferMastership(upgradeGatekeeperContract.target);

        await expect(upgradeGatekeeperContract.addUpgradeable(proxyTestContract.target)).to.emit(
            upgradeGatekeeperContract,
            'NewUpgradable'
        );

        // check initial dummy index and storage
        expect(await proxyDummyInterface.get_DUMMY_INDEX()).to.equal(1);

        // expect(parseInt(await provider.getStorage(proxyTestContract.target, 1))).to.equal(bytes[0]);
        // expect(parseInt(await provider.getStorage(proxyTestContract.target, 2))).to.equal(bytes[1]);
    });

    it('checking that requireMaster calls present', async () => {
        await expect(upgradeGatekeeperContract.connect(wallet).addUpgradeable(hardhat.ethers.ZeroAddress)).to.be.revertedWith('1c');
        await expect(upgradeGatekeeperContract.connect(wallet).startUpgrade([])).to.be.revertedWith('1c');
        await expect(upgradeGatekeeperContract.connect(wallet).cancelUpgrade()).to.be.revertedWith('1c');
        await expect(upgradeGatekeeperContract.connect(wallet).finishUpgrade()).to.be.revertedWith('1c');
    });

    it('checking UpgradeGatekeeper reverts; activation and cancellation upgrade', async () => {
        await expect(upgradeGatekeeperContract.cancelUpgrade()).to.be.revertedWith('cpu11');
        await expect(upgradeGatekeeperContract.finishUpgrade()).to.be.revertedWith('fpu11');
        await expect(upgradeGatekeeperContract.startUpgrade([])).to.be.revertedWith('spu12');
        await expect(upgradeGatekeeperContract.startUpgrade([dummySecond.target])).to.emit(
            upgradeGatekeeperContract,
            'NoticePeriodStart'
        );
        await expect(upgradeGatekeeperContract.startUpgrade([])).to.be.revertedWith('spu11');
        await expect(upgradeGatekeeperContract.cancelUpgrade()).to.emit(upgradeGatekeeperContract, 'UpgradeCancel');
    });

    it('checking that the upgrade works correctly', async () => {
        // activate
        await expect(upgradeGatekeeperContract.startUpgrade([dummySecond.target])).to.emit(
            upgradeGatekeeperContract,
            'NoticePeriodStart'
        );

        const activated_time = performance.now();
        // need to wait unlock time
        await expect(upgradeGatekeeperContract.finishUpgrade()).to.be.revertedWith('fpu12');

        // wait and activate preparation status
        const notice_period = parseInt(await dummyFirst.get_UPGRADE_NOTICE_PERIOD());
        while (performance.now() - activated_time < notice_period * 1000 + 10) {
            // wait
        }

        // finish upgrade without verifying priority operations
        await expect(upgradeGatekeeperContract.finishUpgrade()).to.be.revertedWith('fpu13');
        // finish upgrade
        await proxyDummyInterface.verifyPriorityOperation();
        await expect(upgradeGatekeeperContract.finishUpgrade()).to.emit(
            upgradeGatekeeperContract,
            'UpgradeComplete'
        );

        await expect(await proxyTestContract.getTarget()).to.equal(dummySecond.target);

        // check dummy index and updated storage
        expect(await proxyDummyInterface.get_DUMMY_INDEX()).to.equal(2);
    });
});
