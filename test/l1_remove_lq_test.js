const hardhat = require('hardhat');
const { expect } = require('chai');
const {getL1AddLQPubdata,getL1RemoveLQPubdata} = require('./utils');

describe('L1RemoveLQ unit tests', function () {
    let token, zkSync, zkSyncBlock, governance, vault, nft;
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
        const nftFactory = await hardhat.ethers.getContractFactory('ZKLinkNFT');
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
        await nft.transferOwnership(zkSync.address);
        // add lq
        const amount = 20;
        await token.connect(bob).mint(amount);
        await token.connect(bob).approve(zkSync.address, amount);
        await zkSync.connect(bob).addLiquidity(bob.address, token.address, 20, pair.address, 1);
        const pubdata = getL1AddLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000014', pair:pair.address, lpAmount:'0x00000000000000000000000000000005', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1AddLQ(pubdata);
    });

    it('should revert when exodusMode is active', async () => {
        await zkSync.setExodusMode(true);
        await expect(zkSync.removeLiquidity(alice.address, 1, 1)).to.be.revertedWith("L");
    });

    it('remove lq should success', async () => {
        await expect(zkSync.connect(alice).removeLiquidity(bob.address, 1, 0)).to.be.revertedWith('ZkSync: not nft owner');
        await expect(zkSync.connect(bob).removeLiquidity(bob.address, 1, 0)).to
            .emit(zkSync, 'RemoveLiquidity')
            .withArgs(pair.address, 1, 5);
    });

    it('confirm remove lq should success', async () => {
        await zkSync.connect(bob).removeLiquidity(bob.address, 1, 0);

        const pubdata = getL1RemoveLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000013', pair:pair.address, lpAmount:'0x00000000000000000000000000000005', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1RemoveLQ(pubdata);
        const nftInfo = await nft.tokenLq(1);
        expect(nftInfo.status).to.be.equal(0);
        expect(await zkSync.getPendingBalance(bob.address, token.address)).to.be.equal(19);
    });

    it('revoke remove lq should success', async () => {
        await zkSync.connect(bob).removeLiquidity(bob.address, 1, 0);

        const pubdata = getL1RemoveLQPubdata({ owner:bob.address, chainId:'0x00', tokenId:'0x0001', amount:'0x00000000000000000000000000000000', pair:pair.address, lpAmount:'0x00000000000000000000000000000005', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1RemoveLQ(pubdata);
        const nftInfo = await nft.tokenLq(1);
        expect(nftInfo.status).to.be.equal(2);
        expect(await zkSync.getPendingBalance(bob.address, token.address)).to.be.equal(0);
    });

    it('only current chain will handle add lq op', async () => {
        await zkSync.connect(bob).removeLiquidity(bob.address, 1, 0);

        const pubdata = getL1RemoveLQPubdata({ owner:bob.address, chainId:'0x01', tokenId:'0x0001', amount:'0x00000000000000000000000000000013', pair:pair.address, lpAmount:'0x00000000000000000000000000000005', nftTokenId:'0x00000001' });
        await zkSyncBlock.testExecL1RemoveLQ(pubdata);
        const nftInfo = await nft.tokenLq(1);
        expect(nftInfo.status).to.be.equal(4);
    });
});
