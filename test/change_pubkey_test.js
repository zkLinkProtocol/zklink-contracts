const { ethers } = require("hardhat");
const { expect } = require('chai');
const { deploy } = require('./utils');

describe('ZkLink change pubkey unit tests', function () {
    let zkLink, alice;
    const nonce = 0x1234;
    before(async () => {
        const deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        alice = deployedInfo.alice;
    });

    it('set auth pubkey should be success', async () => {
        const pubkeyHashInvalidLength = '0xfefefefefefefefefefefefefefefefefefefe';
        await expect(zkLink.connect(alice).setAuthPubkeyHash(pubkeyHashInvalidLength, nonce))
            .to.be.revertedWith('Z18');

        const pubkeyHash = '0xfefefefefefefefefefefefefefefefefefefefe';
        await zkLink.connect(alice).setAuthPubkeyHash(pubkeyHash, nonce);

        const expectedAuthFact = ethers.utils.keccak256(pubkeyHash);
        expect(await zkLink.getAuthFact(alice.address, nonce)).to.eq(expectedAuthFact);
    });

    it('reset auth pubkey should be success', async () => {
        const newPubkeyHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

        const oldHash = await zkLink.getAuthFact(alice.address, nonce);
        // reset time count down begin
        await zkLink.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce);
        expect(await zkLink.getAuthFact(alice.address, nonce)).to.eq(oldHash);

        // must wait 24 hours
        const latestBlock = await zkLink.provider.getBlock('latest');
        const resetTimestampTooEarly = latestBlock.timestamp + 23 * 60 * 60;
        await zkLink.provider.send('evm_setNextBlockTimestamp', [resetTimestampTooEarly]);
        await expect(zkLink.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce)).to.be.revertedWith("Z19");

        const resetTimestamp = latestBlock.timestamp + 24 * 60 * 60;
        await zkLink.provider.send('evm_setNextBlockTimestamp', [resetTimestamp]);
        await zkLink.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce);
        expect(await zkLink.getAuthFact(alice.address, nonce)).to.eq(ethers.utils.keccak256(newPubkeyHash));
    });
});
