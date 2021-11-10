const hardhat = require('hardhat');
const { expect } = require('chai');

describe('NFT tests', function () {
    let nft;
    let wallet,alice,bob,pair;
    beforeEach(async () => {
        [wallet,alice,bob,pair] = await hardhat.ethers.getSigners();
        // nft
        const nftFactory = await hardhat.ethers.getContractFactory('ZKLinkNFT');
        nft = await nftFactory.deploy(hardhat.ethers.constants.AddressZero);
        await nft.transferOwnership(alice.address);
    });

    it('require owner should success', async () => {
        await expect(nft.addLq(bob.address, 0, 1, pair.address)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(nft.confirmAddLq(1, 1)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(nft.revokeAddLq(1)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(nft.removeLq(1)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(nft.confirmRemoveLq(1)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(nft.revokeRemoveLq(1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it('add liquidity should success', async () => {
        // mint nft, nft token id = 1
        await nft.connect(alice).addLq(bob.address, 1, 100, pair.address);
        expect((await nft.tokenLq(1)).status).equal(1);
        // ADD_PENDING nft can transfer
        await nft.connect(bob).transferFrom(bob.address, alice.address, 1);

        await expect(nft.connect(alice).confirmAddLq(2, 10)).to.be.revertedWith("ZKLinkNFT: nonexistent token");
        await nft.connect(alice).confirmAddLq(1, 10);
        expect((await nft.tokenLq(1)).status).equal(2);
        // FINAL nft can transfer
        await nft.connect(alice).transferFrom(alice.address, bob.address, 1);

        // mint nft, nft token id = 2
        await nft.connect(alice).addLq(bob.address, 1, 100, pair.address);
        await nft.connect(alice).revokeAddLq(2);
        expect((await nft.tokenLq(2)).status).equal(3);
        // ADD_FAIL nft can transfer
        await nft.connect(bob).transferFrom(bob.address, alice.address, 2);
    });

    it('remove liquidity should success', async () => {
        // mint nft, nft token id = 1
        await nft.connect(alice).addLq(bob.address, 1, 100, pair.address);
        expect((await nft.tokenLq(1)).status).equal(1);

        // remove nft require FINAL
        await expect(nft.connect(alice).removeLq(1)).to.be.revertedWith("ZKLinkNFT: require FINAL");
        await nft.connect(alice).confirmAddLq(1, 10);
        await nft.connect(alice).removeLq(1);
        expect((await nft.tokenLq(1)).status).equal(4);

        // REMOVE_PENDING can not transfer
        await expect(nft.connect(bob).transferFrom(bob.address, alice.address, 1)).to.be.revertedWith("ZKLinkNFT: require !REMOVE_PENDING");

        // confirm remove
        await nft.connect(alice).confirmRemoveLq(1);
        expect((await nft.tokenLq(1)).status).equal(0);

        // revoke remove
        await expect(nft.connect(alice).addLq(bob.address, 1, 100, pair.address)).to
            .emit(nft, 'StatusUpdate')
            .withArgs(2, 1);
        await expect(nft.connect(alice).confirmAddLq(2, 10)).to
            .emit(nft, 'StatusUpdate')
            .withArgs(2, 2);
        await expect(nft.connect(alice).removeLq(2)).to
            .emit(nft, 'StatusUpdate')
            .withArgs(2, 4);
        await expect(nft.connect(alice).revokeRemoveLq(2)).to
            .emit(nft, 'StatusUpdate')
            .withArgs(2, 2);
    });

    it('get user all tokens should success', async () => {
        await nft.connect(alice).addLq(bob.address, 1, 100, pair.address);
        await nft.connect(alice).addLq(bob.address, 1, 100, pair.address);
        let tokens = await nft.totalOfOwner(bob.address);
        expect(tokens[0]).equal(1);
        expect(tokens[1]).equal(2);
    });
});
