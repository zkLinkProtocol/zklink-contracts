const { expect } = require('chai');
const { deploy,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    ZERO_BYTES32,
    EMPTY_STRING_KECCAK
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
    getTransferPubdata,
    mockNoopPubdata,
    createEthWitnessOfECRECOVER,
    OP_DEPOSIT,
    OP_FULL_EXIT,
    CHUNK_BYTES,
    OP_NOOP_CHUNKS,
    OP_DEPOSIT_CHUNKS,
    OP_WITHDRAW_CHUNKS,
    OP_TRANSFER_CHUNKS,
    OP_FULL_EXIT_CHUNKS,
    OP_CHANGE_PUBKEY_CHUNKS,
    OP_FORCE_EXIT_CHUNKS,
    extendAddress
} = require('../script/op_utils');
const { keccak256, arrayify, hexlify, concat, parseEther, sha256} = require("ethers/lib/utils");

describe('Block commit unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, token3, token3Id, defaultSender, alice, bob, governor, verifier;
    let commitBlockTemplate;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
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
            feeAccount:0
        };
    });

    function createOffsetCommitment(opPadding, isOnchainOp) {
        const chunkSize = arrayify(opPadding).length / CHUNK_BYTES;
        const offsetCommitment = [];
        offsetCommitment[0] = isOnchainOp ? '0x01' : '0x00';
        for ( let i = 1; i < chunkSize; i++) {
            offsetCommitment[i] = '0x00';
        }
        return hexlify(concat(offsetCommitment));
    }

    async function buildTestBlock () {
        const block = Object.assign({}, commitBlockTemplate);
        const pubdatas = [];
        const pubdatasOfChain1 = [];
        const ops = [];
        const opsOfChain1 = [];
        // no op of chain 2
        let onchainOpPubdataHash1 = EMPTY_STRING_KECCAK;
        let onchainOpPubdataHash3 = EMPTY_STRING_KECCAK;
        let onchainOpPubdataHash4 = EMPTY_STRING_KECCAK;
        let publicDataOffset = 0;
        let publicDataOffsetOfChain1 = 0;
        let priorityOperationsProcessed = 0;
        let processableOpPubdataHash = EMPTY_STRING_KECCAK;
        let offsetsCommitment = [];

        // deposit of current chain
        let op = getDepositPubdata({chainId:CHAIN_ID,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
        let opOfWrite = writeDepositPubdata({chainId:CHAIN_ID,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
        await zkLink.testAddPriorityRequest(OP_DEPOSIT, opOfWrite);
        let opPadding = paddingChunk(op, OP_DEPOSIT_CHUNKS);
        pubdatas.push(opPadding);
        pubdatasOfChain1.push(opPadding);
        onchainOpPubdataHash1 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash1), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        opsOfChain1.push({ethWitness:"0x",publicDataOffset:publicDataOffsetOfChain1});
        publicDataOffset += arrayify(opPadding).length;
        publicDataOffsetOfChain1 += arrayify(opPadding).length;
        priorityOperationsProcessed++;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // change pubkey of chain 3
        op = getChangePubkeyPubdata({chainId:3,accountId:2,subAccountId:0,pubKeyHash:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',owner:extendAddress(alice.address),nonce:32,tokenId:token2Id,fee:145});
        opPadding = paddingChunk(op, OP_CHANGE_PUBKEY_CHUNKS);
        pubdatas.push(opPadding);
        onchainOpPubdataHash3 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash3), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // transfer of chain 4
        op = getTransferPubdata({fromAccountId:1,fromSubAccountId:0,tokenId:ethId,amount:456,toAccountId:4,toSubAccountId:3,fee:34});
        opPadding = paddingChunk(op, OP_TRANSFER_CHUNKS);
        pubdatas.push(opPadding);
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, false));

        // change pubkey of current chain
        op = getChangePubkeyPubdata({chainId:CHAIN_ID,accountId:2,subAccountId:7,pubKeyHash:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',owner:extendAddress(alice.address),nonce:32,tokenId:token2Id,fee:145});
        opPadding = paddingChunk(op, OP_CHANGE_PUBKEY_CHUNKS);
        pubdatas.push(opPadding);
        pubdatasOfChain1.push(opPadding);
        onchainOpPubdataHash1 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash1), opPadding])));
        let ethWitness = await createEthWitnessOfECRECOVER(zkLink.address,'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',32,2,alice);
        ops.push({ethWitness,publicDataOffset});
        opsOfChain1.push({ethWitness,publicDataOffset:publicDataOffsetOfChain1});
        publicDataOffset += arrayify(opPadding).length;
        publicDataOffsetOfChain1 += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // deposit of chain4
        op = getDepositPubdata({chainId:4,accountId:3,subAccountId:6,tokenId:token3Id,targetTokenId:token3Id,amount:parseEther("0.345"),owner:extendAddress(bob.address)});
        opPadding = paddingChunk(op, OP_DEPOSIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOpPubdataHash4 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash4), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // full exit of chain4
        op = getFullExitPubdata({chainId:4,accountId:43,subAccountId:2,owner:extendAddress(bob.address),tokenId:token3Id,srcTokenId:token3Id,amount:parseEther("24.5")});
        opPadding = paddingChunk(op, OP_FULL_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOpPubdataHash4 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash4), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // mock Noop
        op = mockNoopPubdata();
        opPadding = paddingChunk(op, OP_NOOP_CHUNKS);
        pubdatas.push(opPadding);
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, false));

        // force exit of chain3
        op = getForcedExitPubdata({chainId:3,initiatorAccountId:30,initiatorSubAccountId:7,initiatorNonce:3,targetAccountId:43,targetSubAccountId:2,tokenId:token3Id,srcTokenId:token3Id,amount:parseEther("24.5"),target:extendAddress(alice.address)});
        opPadding = paddingChunk(op, OP_FORCE_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        onchainOpPubdataHash3 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash3), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // withdraw of current chain
        op = getWithdrawPubdata({chainId:CHAIN_ID,accountId:5,subAccountId:0,tokenId:token2Id,srcTokenId:token2Id,amount:900,fee:ethId,owner:extendAddress(bob.address),nonce:14,fastWithdrawFeeRate:50,fastWithdraw:1});
        opPadding = paddingChunk(op, OP_WITHDRAW_CHUNKS);
        pubdatas.push(opPadding);
        pubdatasOfChain1.push(opPadding);
        onchainOpPubdataHash1 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash1), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        opsOfChain1.push({ethWitness:"0x",publicDataOffset:publicDataOffsetOfChain1});
        publicDataOffset += arrayify(opPadding).length;
        publicDataOffsetOfChain1 += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // full exit of current chain
        op = getFullExitPubdata({chainId:CHAIN_ID,accountId:15,subAccountId:2,owner:extendAddress(bob.address),tokenId:ethId,srcTokenId:ethId,amount:parseEther("14")});
        opOfWrite = writeFullExitPubdata({chainId:CHAIN_ID,accountId:15,subAccountId:2,owner:extendAddress(bob.address),tokenId:ethId,srcTokenId:ethId})
        await zkLink.testAddPriorityRequest(OP_FULL_EXIT, opOfWrite);
        opPadding = paddingChunk(op, OP_FULL_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        pubdatasOfChain1.push(opPadding);
        onchainOpPubdataHash1 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash1), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        opsOfChain1.push({ethWitness:"0x",publicDataOffset:publicDataOffsetOfChain1});
        publicDataOffset += arrayify(opPadding).length;
        publicDataOffsetOfChain1 += arrayify(opPadding).length;
        priorityOperationsProcessed++;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // force exit of current chain
        op = getForcedExitPubdata({chainId:CHAIN_ID,initiatorAccountId:13,initiatorSubAccountId:4,initiatorNonce:0,targetAccountId:23,targetSubAccountId:2,tokenId:token3Id,srcTokenId:token3Id,amount:parseEther("24.5"),target:extendAddress(alice.address)});
        opPadding = paddingChunk(op, OP_FORCE_EXIT_CHUNKS);
        pubdatas.push(opPadding);
        pubdatasOfChain1.push(opPadding);
        onchainOpPubdataHash1 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash1), opPadding])));
        processableOpPubdataHash = hexlify(keccak256(concat([arrayify(processableOpPubdataHash), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        opsOfChain1.push({ethWitness:"0x",publicDataOffset:publicDataOffsetOfChain1});
        publicDataOffset += arrayify(opPadding).length;
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        // withdraw of chain4
        op = getWithdrawPubdata({chainId:4,accountId:15,subAccountId:5,tokenId:token2Id,srcTokenId:token2Id,amount:1000,fee:ethId,owner:extendAddress(bob.address),nonce:14,fastWithdrawFeeRate:50,fastWithdraw:0});
        opPadding = paddingChunk(op, OP_WITHDRAW_CHUNKS);
        pubdatas.push(opPadding);
        onchainOpPubdataHash4 = hexlify(keccak256(concat([arrayify(onchainOpPubdataHash4), opPadding])));
        ops.push({ethWitness:"0x",publicDataOffset});
        offsetsCommitment.push(createOffsetCommitment(opPadding, true));

        block.publicData = hexlify(concat(pubdatas));
        block.onchainOperations = ops;
        const expected = {
            processableOpPubdataHash,
            priorityOperationsProcessed,
            offsetsCommitment:hexlify(concat(offsetsCommitment)),
            onchainOperationPubdataHashs:[
                ZERO_BYTES32,
                onchainOpPubdataHash1,
                EMPTY_STRING_KECCAK,
                onchainOpPubdataHash3,
                onchainOpPubdataHash4]
        }
        const pubdataOfChain1 = hexlify(concat(pubdatasOfChain1));
        return {block, expected, pubdataOfChain1, opsOfChain1};
    }

    describe('Collect onchain ops', function () {
        it('invalid pubdata length should be failed', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            block.publicData = "0x01"; // 1 bytes
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h0");

            block.publicData = "0x01010101010101010101010101"; // 13 bytes
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h0");
        });

        async function collectOnchainOps(block, expected) {
            const actual = await zkLink.testCollectOnchainOps(block);
            expect(actual.processableOperationsHash).eq(expected.processableOpPubdataHash);
            expect(actual.priorityOperationsProcessed).eq(expected.priorityOperationsProcessed);
            expect(actual.offsetsCommitment).eq(expected.offsetsCommitment);
            expect(actual.onchainOperationPubdataHashs).eql(expected.onchainOperationPubdataHashs);
        }

        it('no pubdata should be success', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            block.publicData = "0x";
            const expected = {
                processableOpPubdataHash:EMPTY_STRING_KECCAK,
                priorityOperationsProcessed:0,
                offsetsCommitment:"0x",
                onchainOperationPubdataHashs:[
                    ZERO_BYTES32,
                    EMPTY_STRING_KECCAK,
                    EMPTY_STRING_KECCAK,
                    EMPTY_STRING_KECCAK,
                    EMPTY_STRING_KECCAK]
            }
            await collectOnchainOps(block, expected);
        });

        it('invalid pubdata offset should be failed', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            block.publicData = paddingChunk("0x00", OP_NOOP_CHUNKS); // Noop
            block.onchainOperations = [{
                ethWitness:"0x",
                publicDataOffset:arrayify(block.publicData).length
            }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h1");

            block.onchainOperations = [{
                ethWitness:"0x",
                publicDataOffset:1
            }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h2");

            block.onchainOperations = [{
                ethWitness:"0x",
                publicDataOffset:CHUNK_BYTES-2
            }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h2");
        });

        it('invalid op type should be failed', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            block.publicData = paddingChunk("0x0001", OP_NOOP_CHUNKS); // Noop
            block.onchainOperations = [{
                ethWitness:"0x",
                publicDataOffset:0
            }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("k2");
        });

        it('invalid chain id should be failed', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            let depositData = getDepositPubdata({chainId:MIN_CHAIN_ID-1,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
            block.publicData = paddingChunk(depositData, OP_DEPOSIT_CHUNKS);
            block.onchainOperations = [{
                ethWitness:"0x",
                publicDataOffset:0
            }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("i1");

            depositData = getDepositPubdata({chainId:MAX_CHAIN_ID+1,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)});
            block.publicData = paddingChunk(depositData, OP_DEPOSIT_CHUNKS);
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("i1");
        });

        it('duplicate pubdata offset should be failed', async () => {
            const block = Object.assign({}, commitBlockTemplate);
            const depositData0 = paddingChunk(getDepositPubdata({chainId:2,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)}), OP_DEPOSIT_CHUNKS);
            const depositData1 = paddingChunk(getDepositPubdata({chainId:2,accountId:1,subAccountId:0,tokenId:ethId,targetTokenId:ethId,amount:parseEther("500"),owner:extendAddress(alice.address)}), OP_DEPOSIT_CHUNKS);
            block.publicData = hexlify(concat([depositData0, depositData1]));
            block.onchainOperations = [
                {
                    ethWitness:"0x",
                    publicDataOffset:0
                },
                {
                    ethWitness:"0x",
                    publicDataOffset:0
                }];
            await expect(zkLink.testCollectOnchainOps(block))
                .to.be.revertedWith("h3");
        });

        it('pubdata of all chains should be success', async () => {
            const testBlockInfo = await buildTestBlock();
            const block = testBlockInfo.block;
            const expected = testBlockInfo.expected;
            await collectOnchainOps(block, expected);
        });
    });

    describe('Commit one block', function () {
        const preBlock = {
            blockNumber:10,
            priorityOperations:0,
            pendingOnchainOperationsHash:"0x0000000000000000000000000000000000000000000000000000000000000001",
            timestamp:1652422395,
            stateHash:"0x0000000000000000000000000000000000000000000000000000000000000002",
            commitment:"0x0000000000000000000000000000000000000000000000000000000000000003",
            syncHash:"0x0000000000000000000000000000000000000000000000000000000000000004"
        }
        const commitBlock = {
            newStateHash:"0x0000000000000000000000000000000000000000000000000000000000000005",
            publicData:"0x",
            timestamp:1652422395,
            onchainOperations:[],
            blockNumber:11,
            feeAccount:0
        };
        const extraBlock = {
            publicDataHash:ZERO_BYTES32,
            offsetCommitmentHash:ZERO_BYTES32,
            onchainOperationPubdataHashs:[]
        }

        it('invalid block number should be failed', async () => {
            commitBlock.blockNumber = 12;
            await expect(zkLink.testCommitOneBlock(preBlock, commitBlock, false, extraBlock))
                .to.be.revertedWith("g0");
        });

        it('invalid block timestamp should be failed', async () => {
            commitBlock.blockNumber = 11;
            const l1Block = await zkLink.provider.getBlock('latest');
            preBlock.timestamp = l1Block.timestamp;
            commitBlock.timestamp = preBlock.timestamp - 1;
            await expect(zkLink.testCommitOneBlock(preBlock, commitBlock, false, extraBlock))
                .to.be.revertedWith("g2");
        });

        it('commit compressed block should return a result same as full block', async () => {
            const l1Block = await zkLink.provider.getBlock('latest');
            preBlock.timestamp = l1Block.timestamp;
            commitBlock.timestamp = preBlock.timestamp + 1;

            const testBlockInfo = await buildTestBlock();
            const fullBlock = testBlockInfo.block;
            const expected = testBlockInfo.expected;
            const pubdataOfChain1 = testBlockInfo.pubdataOfChain1;
            const opsOfChain1 = testBlockInfo.opsOfChain1;

            commitBlock.publicData = fullBlock.publicData;
            commitBlock.onchainOperations = fullBlock.onchainOperations;

            const r0 = await zkLink.testCommitOneBlock(preBlock, commitBlock, false, extraBlock);

            const compressedBlock = Object.assign({}, commitBlock);
            compressedBlock.publicData = pubdataOfChain1;
            compressedBlock.onchainOperations = opsOfChain1;

            extraBlock.publicDataHash = sha256(arrayify(commitBlock.publicData));
            extraBlock.offsetCommitmentHash = sha256(arrayify(expected.offsetsCommitment));
            extraBlock.onchainOperationPubdataHashs = expected.onchainOperationPubdataHashs;
            const r1 = await zkLink.testCommitOneBlock(preBlock, compressedBlock, true, extraBlock);

            expect(r1).to.eql(r0);
        });
    });
});
