const { ethers } = require("hardhat");
const { expect } = require('chai');
const { deploy } = require('./utils');
const { createEthWitnessOfCREATE2 } = require('../script/op_utils');

describe('ZkLink change pubkey unit tests', function () {
    let zkLink, periphery, alice;
    const nonce = 0x1234;
    before(async () => {
        const deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        alice = deployedInfo.alice;
    });

    it('set auth pubkey should be success', async () => {
        const pubkeyHashInvalidLength = '0xfefefefefefefefefefefefefefefefefefefe';
        await expect(periphery.connect(alice).setAuthPubkeyHash(pubkeyHashInvalidLength, nonce))
            .to.be.revertedWith('B0');

        const pubkeyHash = '0xfefefefefefefefefefefefefefefefefefefefe';
        await periphery.connect(alice).setAuthPubkeyHash(pubkeyHash, nonce);

        const expectedAuthFact = ethers.utils.keccak256(pubkeyHash);
        expect(await periphery.getAuthFact(alice.address, nonce)).to.eq(expectedAuthFact);
    });

    it('reset auth pubkey should be success', async () => {
        const newPubkeyHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

        const oldHash = await periphery.getAuthFact(alice.address, nonce);
        // reset time count down begin
        await expect(periphery.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce))
            .to.be.emit(periphery, 'FactAuthResetTime');
        expect(await periphery.getAuthFact(alice.address, nonce)).to.eq(oldHash);

        // must wait 24 hours
        const latestBlock = await zkLink.provider.getBlock('latest');
        const resetTimestampTooEarly = latestBlock.timestamp + 23 * 60 * 60;
        await zkLink.provider.send('evm_setNextBlockTimestamp', [resetTimestampTooEarly]);
        await expect(periphery.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce)).to.be.revertedWith("B1");

        const resetTimestamp = latestBlock.timestamp + 24 * 60 * 60;
        await zkLink.provider.send('evm_setNextBlockTimestamp', [resetTimestamp]);
        await periphery.connect(alice).setAuthPubkeyHash(newPubkeyHash, nonce);
        expect(await periphery.getAuthFact(alice.address, nonce)).to.eq(ethers.utils.keccak256(newPubkeyHash));
    });

    it('verify CREATE2 should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const accountId = 15;
        const creatorAddress = "0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5";
        const saltArg = "0x1100000000000000000000000000000000000000000000000000000000000000";
        const codeHash = "0x00ff000000000000000000000000000000000000000000000000000000000000";
        const {ethWitness, owner} = createEthWitnessOfCREATE2(pubKeyHash,accountId,creatorAddress,saltArg,codeHash);
        let nonce = 0;
        let changePubKey = {chainId:1,pubKeyHash,nonce,accountId,owner};
        let result = await zkLink.testVerifyChangePubkey(ethWitness, changePubKey);
        expect(result).eq(true);
    });

    it('verifyChangePubkeyECRECOVER should be success', async () => {
        // pubKeyHash has no prefix zero
        let pubKeyHash = "0xdbd9c8235e4fc9d5b9b7bb201f1133e8a28c0edd";
        let nonce = 0;
        let accountId = 2;
        let owner = "0xd09Ad14080d4b257a819a4f579b8485Be88f086c";
        let changePubKey = {chainId:1,pubKeyHash,nonce,accountId,owner};
        let signature = "efd0d9c6beb00310535bb51ee58745adb547e7d875d5823892365a6450caf6c559a6a4bfd83bf336ac59cf83e97948dbf607bf2aecd24f6829c3deac20ecdb601b";
        let witness = "0x00" + signature;
        let result = await zkLink.testVerifyChangePubkey(witness, changePubKey);
        expect(result).eq(true);

        // pubKeyHash has prefix zero
        pubKeyHash = "0x0043a38170c9fe8ff718bb86435814468a616044";
        nonce = 0;
        accountId = 5;
        owner = "0x72efa702385d5e2a338344056a2bafc391eb7ba6";
        changePubKey = {chainId:1,pubKeyHash,nonce,accountId,owner};
        signature = "946cdf8391fd348412ebf0f875be9c48a2512fdf1916cbf235a27f688de40a7574d45616a9684358ea71c3e25df2cc9f58df269c8370d8bb3739e9cfbba6a34b1c";
        witness = "0x00" + signature;
        result = await zkLink.testVerifyChangePubkey(witness, changePubKey);
        expect(result).eq(true);
    });
});
