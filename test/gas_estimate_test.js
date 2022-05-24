const { expect } = require('chai');
const { deploy,
    paddingChunk,
    getDepositPubdata,
    writeDepositPubdata,
    getChangePubkeyPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    writeFullExitPubdata,
    getForcedExitPubdata,
    mockTransferPubdata,
    mockNoopPubdata,
    createEthWitnessOfECRECOVER,
    OP_DEPOSIT,
    OP_FULL_EXIT,
    CHUNK_BYTES,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    COMMIT_TIMESTAMP_NOT_OLDER,
    COMMIT_TIMESTAMP_APPROXIMATION_DELTA,
    EMPTY_STRING_KECCAK,
    GENESIS_ROOT
} = require('./utils');
const { keccak256, arrayify, hexlify, concat, parseEther, sha256} = require("ethers/lib/utils");

describe('Gas estimate unit tests', function () {
    let zkLink, periphery, ethId, token2, token2Id, token3, token3Id, defaultSender, alice, bob, governance, governor, verifier, validator;
    beforeEach(async () => {
        const deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
        governance = deployedInfo.governance;
        governor = deployedInfo.governor;
        verifier = deployedInfo.verifier;
        validator = deployedInfo.validator;
    });

    describe('Commit blocks', function () {
        let preBlock;
        beforeEach(async () => {
            preBlock = {
                blockNumber:0,
                priorityOperations:0,
                pendingOnchainOperationsHash:EMPTY_STRING_KECCAK,
                timestamp:0,
                stateHash:GENESIS_ROOT,
                commitment:"0x0000000000000000000000000000000000000000000000000000000000000000",
                syncHash:EMPTY_STRING_KECCAK
            }
        });

        it('no pubdata', async () => {
            const l1Block = await zkLink.provider.getBlock('latest');
            const commitBlocks = [];
            for (let i = 1; i <= 5; i++) {
                const commitBlock = {
                    newStateHash:keccak256(hexlify(i)),
                    publicData:"0x",
                    timestamp:l1Block.timestamp + i,
                    onchainOperations:[],
                    blockNumber:i,
                    feeAccount:0
                };
                commitBlocks.push(commitBlock);
            }
            const tx = await zkLink.connect(validator).commitBlocks(preBlock, commitBlocks);
            let txr = await zkLink.provider.getTransactionReceipt(tx.hash);
            let gasUsed = txr.gasUsed;
            console.log(gasUsed.toNumber());
        });
    });
});
