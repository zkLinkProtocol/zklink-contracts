const { ethers } = require("hardhat");
const { expect } = require('chai');
const { deploy } = require('./utils');
const { getChangePubkeyPubdata, paddingChunk, createEthWitnessOfECRECOVER, createEthWitnessOfCREATE2,
    OP_CHANGE_PUBKEY_CHUNKS, extendAddress
} = require('../script/op_utils');

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

    it('verify onchain pubkey should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId:1, subAccountId:4, pubKeyHash, owner:extendAddress(alice.address), nonce, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata, OP_CHANGE_PUBKEY_CHUNKS);
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
        const result = await zkLink.testCollectOnchainOps(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x010000');
    });

    it('verify ECRECOVER should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const accountId = 15;
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId, subAccountId:5, pubKeyHash, owner:extendAddress(alice.address), nonce, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata, OP_CHANGE_PUBKEY_CHUNKS);
        const ethWitness = createEthWitnessOfECRECOVER(pubKeyHash,nonce,accountId,alice);
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
        const result = await zkLink.testCollectOnchainOps(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x010000');
    });

    it('verify CREATE2 should be success', async () => {
        const pubKeyHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const accountId = 15;
        const creatorAddress = "0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5";
        const saltArg = "0x1100000000000000000000000000000000000000000000000000000000000000";
        const codeHash = "0x00ff000000000000000000000000000000000000000000000000000000000000";
        const {ethWitness, owner} = createEthWitnessOfCREATE2(pubKeyHash,accountId,creatorAddress,saltArg,codeHash);
        const pubdata = getChangePubkeyPubdata({chainId:1, accountId, subAccountId:0, pubKeyHash, owner:extendAddress(owner), nonce:0, tokenId:0, fee:0});
        const pubdataPadding = paddingChunk(pubdata, OP_CHANGE_PUBKEY_CHUNKS);

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
        const result = await zkLink.testCollectOnchainOps(commitBlockInfo);
        expect(result.processableOperationsHash).eq(ethers.utils.keccak256("0x"));
        expect(result.priorityOperationsProcessed).eq(0);
        expect(result.offsetsCommitment).eq('0x010000');
    });

    it('verifyChangePubkeyECRECOVER should be success', async () => {
        const pubKeyHash = "0xdbd9c8235e4fc9d5b9b7bb201f1133e8a28c0edd";
        const nonce = 0;
        const accountId = 2;
        const owner = "0xd09Ad14080d4b257a819a4f579b8485Be88f086c";
        const changePubKey = {chainId:1,pubKeyHash,nonce,accountId,owner};
        const signature = "efd0d9c6beb00310535bb51ee58745adb547e7d875d5823892365a6450caf6c559a6a4bfd83bf336ac59cf83e97948dbf607bf2aecd24f6829c3deac20ecdb601b";
        const witness = "0x00" + signature;
        const result = await zkLink.testVerifyChangePubkeyECRECOVER(witness, changePubKey);
        expect(result).eq(true);
    });
});
