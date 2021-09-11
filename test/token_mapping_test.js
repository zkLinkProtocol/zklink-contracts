const hardhat = require('hardhat');
const { expect } = require('chai');
const {getMappingPubdata} = require('./utils');

describe('Token mapping unit tests', function () {
    let token, zkSync, zkSyncBlock, governance, vault;
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
        await governance.connect(alice).addToken(token.address); // tokenId = 1
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
        await zkSync.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','bytes32'],
                [governance.address, verifier.address, zkSyncBlockRaw.address, vault.address, hardhat.ethers.utils.arrayify("0x1b06adabb8022e89da0ddb78157da7c57a5b7356ccc9ad2f51475a4bb13970c6")])
        );
        await vault.setZkSyncAddress(zkSync.address);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.mappingToken(wallet.address, alice.address, 0, token.address, 1)).to.be.revertedWith("L");
    });

    it('token mapping should success', async () => {
        const toChainId = 1;
        const amount = hardhat.ethers.utils.parseEther("1");
        const to = bob.address;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);

        await expect(zkSync.connect(bob).mappingToken(bob.address, to, amount, token.address, 0)).to.be.revertedWith("ZkSync: toChainId");
        await expect(zkSync.connect(bob).mappingToken(bob.address, to, amount, token.address, 1)).to.be.revertedWith("ZkSync: not mapping token");

        await governance.connect(alice).setTokenMapping(token.address, true);
        await zkSync.connect(bob).mappingToken(bob.address, to, amount, token.address, toChainId);
        expect(await token.balanceOf(vault.address)).equal(amount);
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        const amount = 20;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await governance.connect(alice).setTokenMapping(token.address, true);
        await zkSync.connect(bob).mappingToken(bob.address, bob.address, amount, token.address, 1);

        const pubdata = getMappingPubdata({ fromChainId:'0x00', toChainId:'0x01', owner:bob.address, to:bob.address, tokenId:'0x0001', amount:'0x00000000000000000000000000000014', fee:'0x00000000000000000000000000000000' });
        await zkSync.setExodusMode(true);
        await zkSync.cancelOutstandingDepositsForExodusMode(1, [pubdata]);
        await expect(zkSync.connect(bob).withdrawPendingBalance(bob.address, token.address, 20)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(1, 20);
    });
});
