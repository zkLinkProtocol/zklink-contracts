const { ethers } = require("hardhat");
const { expect } = require('chai');
const { deploy, getChangePubkeyPubdata, paddingChunk } = require('./utils');

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

    it('verify onchain pubkey should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId:1, pubKeyHash, owner:alice.address, nonce, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata);
        const onchainOperations = [{
            "ethWitness":"0x",
            "publicDataOffset":0
        }];
        const commitBlockInfo = {
            "newStateHash":"0x0000000000000000000000000000000000000000000000000000000000000001",
            "publicData":pubdataPadding,
            "timestamp":1,
            "onchainOperations":onchainOperations,
            "blockNumber":1,
            "feeAccount":0
        };
        const result = await periphery.collectOnchainOpsTest(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x01000000');
    });

    it('verify ECRECOVER should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const accountId = 15;
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId, pubKeyHash, owner:alice.address, nonce, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata);
        const sigMsg = ethers.utils.solidityPack(
            ["bytes20","uint32","uint32","bytes32"],
            [pubKeyHash,nonce,accountId,'0x0000000000000000000000000000000000000000000000000000000000000000']);
        const signature = await alice.signMessage(ethers.utils.arrayify(sigMsg));
        const ethWitness = ethers.utils.solidityPack(["bytes1","bytes"],[0, signature]);
        const onchainOperations = [{
            "ethWitness":ethWitness,
            "publicDataOffset":0
        }];
        const commitBlockInfo = {
            "newStateHash":"0x0000000000000000000000000000000000000000000000000000000000000001",
            "publicData":pubdataPadding,
            "timestamp":1,
            "onchainOperations":onchainOperations,
            "blockNumber":1,
            "feeAccount":0
        };
        const result = await periphery.collectOnchainOpsTest(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x01000000');
    });

    it('verify CREATE2 should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const accountId = 15;
        const creatorAddress = "0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5";
        const saltArg = "0x1100000000000000000000000000000000000000000000000000000000000000";
        const codeHash = "0x00ff000000000000000000000000000000000000000000000000000000000000";
        const ethWitness = ethers.utils.solidityPack(["bytes1","address","bytes32","bytes32"],[1, creatorAddress, saltArg, codeHash]);
        const salt = ethers.utils.keccak256(ethers.utils.arrayify(ethers.utils.solidityPack(["bytes32","bytes20"],[saltArg, pubKeyHash])));
        const owner = ethers.utils.getCreate2Address(creatorAddress, ethers.utils.arrayify(salt), ethers.utils.arrayify(codeHash));
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId, pubKeyHash, owner, nonce:0, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata);

        const onchainOperations = [{
            "ethWitness":ethWitness,
            "publicDataOffset":0
        }];
        const commitBlockInfo = {
            "newStateHash":"0x0000000000000000000000000000000000000000000000000000000000000001",
            "publicData":pubdataPadding,
            "timestamp":1,
            "onchainOperations":onchainOperations,
            "blockNumber":1,
            "feeAccount":0
        };
        const result = await periphery.collectOnchainOpsTest(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x01000000');
    });
});
