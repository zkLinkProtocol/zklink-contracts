const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { deploy,
    CHAIN_ID,
    EMPTY_STRING_KECCAK, IS_MASTER_CHAIN, createSlaverChainSyncHash
} = require('./utils');
const {
    paddingChunk,
    getDepositPubdata,
    writeDepositPubdata,
    getChangePubkeyPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    writeFullExitPubdata,
    getForcedExitPubdata,
    createEthWitnessOfECRECOVER,
    OP_DEPOSIT,
    OP_FULL_EXIT,
    OP_DEPOSIT_CHUNKS,
    OP_WITHDRAW_CHUNKS,
    OP_FULL_EXIT_CHUNKS,
    OP_CHANGE_PUBKEY_CHUNKS,
    OP_FORCE_EXIT_CHUNKS,
    extendAddress
} = require('../script/op_utils');
const { keccak256,  parseEther} = require("ethers");
const { arrayify, hexlify, concat } = require("@ethersproject/bytes")

if (IS_MASTER_CHAIN) {
    console.log("Compressed block commit unit tests only support slaver chain");
    return;
}

describe('Compressed block commit unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, defaultSender, alice, bob, governor, verifier;
    let commitBlockTemplate;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
        governor = deployedInfo.governor;
        verifier = deployedInfo.verifier;

        commitBlockTemplate = {
            newStateHash:"0xbb66ffc06a476f05a218f6789ca8946e4f0cf29f1efc2e4d0f9a8e70f0326313",
            publicData:"0x",
            timestamp:1652422395,
            onchainOperations:[],
            blockNumber:10,
        };
    });

    async function buildTestBlock () {
        const block = Object.assign({}, commitBlockTemplate);
        const pubdatas = [];
        const ops = [];
        let onchainOperationPubdataHash = EMPTY_STRING_KECCAK;
        let publicDataOffset = 0;
        let priorityOperationsProcessed = 0;
        let processableOpPubdataHash = EMPTY_STRING_KECCAK;

        // deposit of current chain
        let op = getDepositPubdata({chainId:CHAIN_ID,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
        let opOfWrite = writeDepositPubdata({chainId:CHAIN_ID,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
        await zkLink.testAddPriorityRequest(OP_DEPOSIT, opOfWrite);
        let opPadding = paddingChunk(op, OP_DEPOSIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOperationPubdataHash = hexlify(keccak256(concat([arrayify(onchainOperationPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        priorityOperationsProcessed++;

        // change pubkey of current chain
        op = getChangePubkeyPubdata({chainId:CHAIN_ID,accountId:2,subAccountId:7,pubKeyHash:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',owner:extendAddress(alice.address),nonce:32,tokenId:token2Id,fee:145});
        opPadding = paddingChunk(op, OP_CHANGE_PUBKEY_CHUNKS);
        pubdatas.push(opPadding);
        onchainOperationPubdataHash = hexlify(keccak256(concat([arrayify(onchainOperationPubdataHash), opPadding])));
        let ethWitness = await createEthWitnessOfECRECOVER('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',32,2,alice);
        ops.push({ethWitness,publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;

        // withdraw of current chain
        op = getWithdrawPubdata({chainId:CHAIN_ID,accountId:5,subAccountId:0,tokenId:token2Id,srcTokenId:token2Id,amount:900,fee:ethId,owner:extendAddress(bob.address),nonce:14,fastWithdrawFeeRate:50,withdrawToL1:0});
        opPadding = paddingChunk(op, OP_WITHDRAW_CHUNKS);
        pubdatas.push(opPadding);
        onchainOperationPubdataHash = hexlify(keccak256(concat([arrayify(onchainOperationPubdataHash), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;

        // full exit of current chain
        op = getFullExitPubdata({chainId:CHAIN_ID,accountId:15,subAccountId:2,owner:extendAddress(bob.address),tokenId:ethId,srcTokenId:ethId,amount:parseEther("14")});
        opOfWrite = writeFullExitPubdata({chainId:CHAIN_ID,accountId:15,subAccountId:2,owner:extendAddress(bob.address),tokenId:ethId,srcTokenId:ethId})
        await zkLink.testAddPriorityRequest(OP_FULL_EXIT, opOfWrite);
        opPadding = paddingChunk(op, OP_FULL_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOperationPubdataHash = hexlify(keccak256(concat([arrayify(onchainOperationPubdataHash), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        priorityOperationsProcessed++;

        // force exit of current chain
        op = getForcedExitPubdata({chainId:CHAIN_ID,initiatorAccountId:13,initiatorSubAccountId:4,initiatorNonce:0,targetAccountId:23,targetSubAccountId:2,tokenId:token2Id,srcTokenId:token2Id,amount:parseEther("24.5"),withdrawToL1:0,target:extendAddress(alice.address)});
        opPadding = paddingChunk(op, OP_FORCE_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOperationPubdataHash = hexlify(keccak256(concat([arrayify(onchainOperationPubdataHash), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});

        block.publicData = hexlify(concat(pubdatas));
        block.onchainOperations = ops;
        const expected = {
            processableOpPubdataHash,
            priorityOperationsProcessed,
            onchainOperationPubdataHash
        }
        return {block, expected};
    }

    describe('Commit one block', function () {
        const preBlock = {
            blockNumber:10,
            blockSequence: 1,
            priorityOperations:0,
            pendingOnchainOperationsHash:"0x0000000000000000000000000000000000000000000000000000000000000001",
            syncHash:"0x0100000000000000000000000000000000000000000000000000000000000000"
        }
        const commitBlock = {
            newStateHash:"0x0000000000000000000000000000000000000000000000000000000000000005",
            publicData:"0x",
            timestamp:1652422395,
            onchainOperations:[],
            blockNumber:13,
        };

        it('invalid block number should be failed', async () => {
            commitBlock.blockNumber = 9;
            await expect(zkLink.testCommitOneBlock(preBlock, commitBlock))
                .to.be.revertedWith("g0");
        });

        it('commit block should success', async () => {
            const testBlockInfo = await buildTestBlock();
            const block = testBlockInfo.block;
            const expected = testBlockInfo.expected;

            commitBlock.blockNumber = 13;
            commitBlock.publicData = block.publicData;
            commitBlock.onchainOperations = block.onchainOperations;

            const r = await zkLink.testCommitOneBlock(preBlock, commitBlock);
            const syncHash = hexlify(createSlaverChainSyncHash(preBlock.syncHash, commitBlock.blockNumber, commitBlock.newStateHash, expected.onchainOperationPubdataHash));
            expect(r.blockNumber).to.eql(commitBlock.blockNumber);
            expect(r.blockSequence).to.eql(preBlock.blockSequence + 1);
            expect(r.priorityOperations).to.eql(BigNumber.from(expected.priorityOperationsProcessed));
            expect(r.pendingOnchainOperationsHash).to.eql(expected.processableOpPubdataHash);
            expect(r.syncHash).to.eql(syncHash);
        });
    });
});
