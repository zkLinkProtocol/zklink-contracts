const hardhat = require('hardhat');
const { expect } = require('chai');
const {getL1AddLQPubdata} = require('./utils');

describe('L1AddLQ unit tests', function () {
    let token, zkSync, zkSyncBlock, zkSyncExit, governance, vault, nft;
    let wallet,alice,bob,pair;
    beforeEach(async () => {
        [wallet,alice,bob,pair] = await hardhat.ethers.getSigners();
        // token
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        token = await erc20Factory.deploy(10000);
        // governance, alice is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        await governance.connect(alice).addToken(token.address, false); // tokenId = 1
        await governance.connect(alice).setValidator(bob.address, true); // set bob as validator
        // nft
        const nftFactory = await hardhat.ethers.getContractFactory('ZkLinkNFT');
        nft = await nftFactory.deploy(hardhat.ethers.constants.AddressZero);
        await governance.connect(alice).changeNft(nft.address);
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
        await nft.transferOwnership(zkSync.address);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.addLiquidity(alice.address, token.address, 100, pair.address, 1)).to.be.revertedWith("L");
    });

    it('add lq should success', async () => {
        const amount = hardhat.ethers.utils.parseEther("1");
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await zkSync.connect(bob).addLiquidity(bob.address, token.address, amount, pair.address, 1);
        expect(await token.balanceOf(vault.address)).equal(amount);
        expect(await nft.ownerOf(1)).equal(bob.address);
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        const amount = 20;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await expect(zkSync.connect(bob).addLiquidity(bob.address, token.address, 20, pair.address, 1)).to
            .emit(nft, 'StatusUpdate')
            .withArgs(1, 1);

        const pubdata = getL1AddLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000014', pair:pair.address, minLpAmount:'0x00000000000000000000000000000001', lpAmount:'0x00000000000000000000000000000000', nftTokenId:'0x00000001' });
        await zkSync.setExodusMode(true);
        await zkSyncExit.cancelOutstandingDepositsForExodusMode(1, [pubdata]);
        await expect(zkSyncExit.connect(bob).withdrawPendingBalance(bob.address, token.address, 20)).to
            .emit(zkSync, 'Withdrawal')
            .withArgs(1, 20);
    });

    it('confirm add lq should success', async () => {
        const amount = 20;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await zkSync.connect(bob).addLiquidity(bob.address, token.address, 20, pair.address, 1);

        const pubdata = getL1AddLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000014', pair:pair.address, minLpAmount:'0x00000000000000000000000000000002', lpAmount:'0x00000000000000000000000000000005', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1AddLQ(pubdata);
        const nftInfo = await nft.tokenLq(1);
        expect(nftInfo.status).to.be.equal(2);
        expect(nftInfo.lpTokenAmount).to.be.equal(5);
    });

    it('revoke add lq should success', async () => {
        const amount = 20;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await zkSync.connect(bob).addLiquidity(bob.address, token.address, 20, pair.address, 1);

        const pubdata = getL1AddLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000014', pair:pair.address, minLpAmount:'0x00000000000000000000000000000002',lpAmount:'0x00000000000000000000000000000000', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1AddLQ(pubdata);
        const nftInfo = await nft.tokenLq(1);
        expect(nftInfo.status).to.be.equal(3);
    });
});
