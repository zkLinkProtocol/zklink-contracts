const hardhat = require('hardhat');
const { expect } = require('chai');

describe('DeployFactory unit tests', function () {
    let defaultSender,governor,validator,feeAccount;
    let zkSyncProxy, vaultProxy;
    beforeEach(async () => {
        [defaultSender,governor,validator,feeAccount] = await hardhat.ethers.getSigners();
        // governance
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        const vault = await vaultFactory.deploy();
        // zkSyncBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlock');
        const zkSyncBlock = await zkSyncBlockFactory.deploy();
        // zkSyncExit
        const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkSyncExit');
        const zkSyncExit = await zkSyncExitFactory.deploy();
        // zkSync
        const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkSync');
        const zkSync = await zkSyncFactory.deploy();

        const genesisRoot = hardhat.ethers.utils.arrayify("0x209d742ecb062db488d20e7f8968a40673d718b24900ede8035e05a78351d956");

        // deployer
        const deployerFactory = await hardhat.ethers.getContractFactory('DeployFactory');
        const deployer = await deployerFactory.deploy(
            zkSyncBlock.address,
            zkSyncExit.address,
            governance.address,
            verifier.address,
            vault.address,
            zkSync.address,
            genesisRoot,
            validator.address,
            governor.address,
            feeAccount.address
        );
        const txr = await deployer.deployTransaction.wait();
        const log = deployer.interface.parseLog(txr.logs[4]);
        const zksyncAddr = log.args.zksync;
        const vaultAddr = log.args.vault;
        zkSyncProxy = zkSyncFactory.attach(zksyncAddr);
        vaultProxy = vaultFactory.attach(vaultAddr);
    });

    it('deposit eth should success', async () => {
        await expect(zkSyncProxy.depositETH(defaultSender.address, {value:30})).to
            .emit(zkSyncProxy, 'Deposit')
            .withArgs(0, 30);
        let contractBalance = await hardhat.ethers.provider.getBalance(vaultProxy.address);
        expect(contractBalance).equal(30);
    });
});
