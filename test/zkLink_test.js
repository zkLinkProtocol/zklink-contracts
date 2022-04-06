const hardhat = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');
const { writeDepositPubdata } = require('./utils');

describe('ZkLink unit tests', function () {
    const tokenA = "0xe4815AE53B124e7263F08dcDBBB757d41Ed658c6";
    const tokenB = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    let zkSync, zkSyncBlock, zkSyncExit, vault;
    let wallet,alice,bob;
    let tokenD;
    beforeEach(async () => {
        [wallet,alice,bob] = await hardhat.ethers.getSigners();
        // tokenD
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        tokenD = await erc20Factory.deploy(10000);
        // governance, alice is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        await governance.connect(alice).addToken(tokenA); // tokenId = 1
        await governance.connect(alice).addToken(tokenB); // tokenId = 2
        await governance.connect(alice).addToken(tokenD.address); // tokenId = 3
        await governance.connect(alice).setValidator(bob.address, true); // set bob as validator
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // Vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        vault = await vaultFactory.deploy();
        await vault.initialize(hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governance.address]));
        // ZkSync
        const contractFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
        zkSync = await contractFactory.deploy();
        // ZkSyncCommitBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkLinkBlockTest');
        const zkSyncBlockRaw = await zkSyncBlockFactory.deploy();
        zkSyncBlock = zkSyncBlockFactory.attach(zkSync.address);
        // ZkSyncExit
        const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkLinkExit');
        const zkSyncExitRaw = await zkSyncExitFactory.deploy();
        zkSyncExit = zkSyncExitFactory.attach(zkSync.address);
        await zkSync.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                [governance.address, verifier.address, vault.address, zkSyncBlockRaw.address, zkSyncExitRaw.address, hardhat.ethers.utils.arrayify("0x1b06adabb8022e89da0ddb78157da7c57a5b7356ccc9ad2f51475a4bb13970c6")])
        );
        await vault.setZkLinkAddress(zkSync.address);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.depositERC20(tokenA, 100, wallet.address)).to.be.revertedWith("L");
        await expect(zkSync.requestFullExit(1, tokenA)).to.be.revertedWith("L");
    });

    it('should revert when update zkLinkBlock address in logic contract', async () => {
        const zkLinkHackerFactory = await hardhat.ethers.getContractFactory('ZkLinkHacker');
        const zkLinkHacker = await zkLinkHackerFactory.deploy();
        await zkSync.setProxyMode(false);
        await expect(zkSync.upgrade(hardhat.ethers.utils.defaultAbiCoder.encode(['address','address'], [zkLinkHacker.address, zkLinkHacker.address])))
            .to.be.revertedWith("ZkLink: call should be in proxy mode");
    });

    it('deposit erc20 should success', async () => {
        let senderBalance = await tokenD.balanceOf(wallet.address);
        let contractBalance = await tokenD.balanceOf(vault.address);
        await tokenD.approve(zkSync.address, 100);
        await expect(zkSync.depositERC20(tokenD.address, 30, alice.address)).to
            .emit(zkSync, 'Deposit')
            .withArgs(3, 30);
        expect(await tokenD.balanceOf(vault.address)).equal(contractBalance.add(30));
        expect(await tokenD.balanceOf(wallet.address)).equal(senderBalance.sub(30));
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        // require exodus mode
        await expect(zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("8");

        // no deposits to process
        await zkSync.setExodusMode(true);
        await expect(zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("9");

        await zkSync.setExodusMode(false);
        await tokenD.approve(zkSync.address, 100);
        await zkSync.depositERC20(tokenD.address, 30, alice.address);
        await zkSync.depositERC20(tokenD.address, 20, alice.address);

        const chainId = '0x01';
        const tokenId = '0x0003';
        const amount0 = '0x0000000000000000000000000000001e';
        const amount1 = '0x00000000000000000000000000000014';
        const owner = alice.address;
        const pubdata0 = writeDepositPubdata({ chainId, tokenId, amount:amount0, owner });
        const pubdata1 = writeDepositPubdata({ chainId, tokenId, amount:amount1, owner });

        await zkSync.setExodusMode(true);
        const b0 = await tokenD.balanceOf(alice.address);
        await zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
        const b1 = await tokenD.balanceOf(alice.address);
        expect(b1.sub(b0)).to.be.equal(50);
    });

    it('requestFullExit should success', async () => {
        // account id can not over limit
        const MAX_ACCOUNT_ID = (2**24) - 1;
        await expect(zkSync.requestFullExit(MAX_ACCOUNT_ID + 1, tokenA)).to.be.revertedWith("e");

        await expect(zkSync.connect(wallet).requestFullExit(1, tokenA)).to
            .emit(zkSync, 'NewPriorityRequest');
    });

    it('createBlockCommitment contain self chain data should success', async () => {
        const previousBlock = {
            blockNumber:0,
            priorityOperations:0,
            pendingOnchainOperationsHash:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000'),
            timestamp:0,
            stateHash: hardhat.ethers.utils.arrayify('0x26e6e312fd7a24967587edd956f7c932b56888c44186f903a39975d27d3473c7'),
            commitment:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000')
        }
        const newBlockData = {
            newStateHash:hardhat.ethers.utils.arrayify('0x1a2ef2aa9f890664ce7b3e412272495d45858b2443d9d375d9adcb3699630fcf'),
            publicData:hardhat.ethers.utils.arrayify('0x0b000000000001000000026fc23ac00900000001000000000100000000000000000000000b000000000001000000026fc23ac0090000000100000000010000000000000000000000'),
            timestamp:305419896,
            onchainOperations: [{ethWitness:[],publicDataOffset:0},{ethWitness:[],publicDataOffset:36}],
            blockNumber:1,
            feeAccount:0
        }
        const offsetCommitment = hardhat.ethers.utils.arrayify('0x0000000000000000');
        expect(await zkSyncBlock.testBlockCommitment(previousBlock, newBlockData, offsetCommitment)).to.equal('0xe7b31627476f17be31f1377910f7c44eb41d91ad26144b79dd682e891a4fb6cf');
    });

    it('createBlockCommitment contain cross chain data should success', async () => {
        const previousBlock = {
            blockNumber:0,
            priorityOperations:0,
            pendingOnchainOperationsHash:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000'),
            timestamp:0,
            stateHash: hardhat.ethers.utils.arrayify('0x125ff49d4c0372404e289e31068166e0653064efb93b16e49706958707d083c1'),
            commitment:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000')
        }
        const newBlockData = {
            newStateHash:hardhat.ethers.utils.arrayify('0x032dd983f30763e0fc4664cc513a3832c7d6883382371732dbe3d9be14fb0cf3'),
            publicData:hardhat.ethers.utils.arrayify('0x0b000100000001000000026fc23ac00900000001000000000100000000000000000000000b000100000001000000026fc23ac0090000000100000000010000000000000000000000'),
            timestamp:305419896,
            onchainOperations: [{ethWitness:[],publicDataOffset:0},{ethWitness:[],publicDataOffset:36}],
            blockNumber:1,
            feeAccount:0
        }
        const offsetCommitment = hardhat.ethers.utils.arrayify('0x0000000000000000');
        expect(await zkSyncBlock.testBlockCommitment(previousBlock, newBlockData, offsetCommitment)).to.equal('0x107659691c238119dfcedd821c25bb8c4dacb68b0775245d4e370f582d7513b3');
    });
});
