// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { deploy,
    paddingChunk,
    getDepositPubdata,
    writeDepositPubdata,
    getChangePubkeyPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    writeFullExitPubdata,
    getTransferPubdata,
    getTransferToNewPubdata,
    getOrderMatchingPubdata,
    createEthWitnessOfECRECOVER,
    createEthWitnessOfCREATE2,
    calAcceptHash,
    OP_DEPOSIT,
    OP_FULL_EXIT,
    OP_TRANSFER,
    OP_TRANSFER_TO_NEW,
    OP_ORDER_MATCHING,
    OP_CHANGE_PUBKEY,
    OP_WITHDRAW,
    CHAIN_ID,
    ZERO_BYTES32,
    GENESIS_BLOCK,
} = require('../test/utils');
const { keccak256, arrayify, hexlify, concat, parseEther} = require("ethers/lib/utils");
const {BigNumber, constants} = require("ethers");
const hardhat = require("hardhat");

class TestSetUp {

    async init() {
        const deployedInfo = await deploy();
        this.zkLink = deployedInfo.zkLink;
        this.verifier = deployedInfo.verifier;
        this.periphery = deployedInfo.periphery;
        this.validator = deployedInfo.validator;
        this.ethId = deployedInfo.eth.tokenId;
        this.token2 = deployedInfo.token2.contract;
        this.token2Id = deployedInfo.token2.tokenId;
        this.alice = deployedInfo.alice;
        this.bob = deployedInfo.bob;
        this.storedBlock = [];
        this.storedBlock.push(GENESIS_BLOCK);
        this.totalCommitted = GENESIS_BLOCK.blockNumber;
        this.totalProven = GENESIS_BLOCK.blockNumber;
        this.totalExecuted = GENESIS_BLOCK.blockNumber;
        // mock verifier resul always true
        await this.verifier.setVerifyResult(true);
        // mint token to zkLink for withdraw
        await this.zkLink.provider.send("hardhat_setBalance", [this.zkLink.address, parseEther("1000").toHexString()]);
        await this.token2.mintTo(this.zkLink.address, parseEther("100000000"));
    }

    createCommitBlock(newBlockNumber, publicData, onchainOperations) {
        return {
            newStateHash:keccak256(hexlify(newBlockNumber)),
            publicData:publicData,
            timestamp:Math.ceil(Date.now()/1000),
            onchainOperations:onchainOperations,
            blockNumber:newBlockNumber,
            feeAccount:0 // it's real in zkLink, not mock
        };
    }

    async commitBlocks(nBlocks, publicData, onchainOperations) {
        const commitBlocks = [];
        let preBlock = this.storedBlock[this.totalCommitted];
        for (let i = 1; i <= nBlocks; i++) {
            const blockNumber = this.totalCommitted + i;
            const commitBlock = this.createCommitBlock(blockNumber, publicData, onchainOperations);
            const extraInfo = {
                publicDataHash:ZERO_BYTES32,
                offsetCommitmentHash:ZERO_BYTES32,
                onchainOperationPubdataHashs:[]
            };
            preBlock = await this.zkLink.testCommitOneBlock(preBlock, commitBlock, false, extraInfo);
            this.storedBlock.push(preBlock);
            commitBlocks.push(commitBlock);
        }

        preBlock = this.storedBlock[this.totalCommitted];
        const tx = await this.zkLink.connect(this.validator).commitBlocks(preBlock, commitBlocks);
        let txr = await this.zkLink.provider.getTransactionReceipt(tx.hash);
        this.totalCommitted += nBlocks;
        return txr.gasUsed;
    }

    async proveBlocks(nBlocks) {
        const committedBlocks = [];
        const proofInput = {
            recursiveInput:[],
            proof:[],
            commitments:[],
            vkIndexes:[],
            subproofsLimbs:[]
        };
        // recursiveInput length is VerificationKey.num_inputs defined in PlonkCore.sol
        proofInput.recursiveInput.push(constants.MaxUint256);
        proofInput.vkIndexes.push(255);
        for (let i = 1; i <= nBlocks; i++) {
            const sb = this.storedBlock[this.totalProven + i];
            committedBlocks.push(sb);
            proofInput.commitments.push(BigNumber.from(sb.commitment));
        }
        // SERIALIZED_PROOF_LENGTH defined in PlonkCore.sol
        for (let i = 0; i < 34; i++) {
            proofInput.proof.push(constants.MaxUint256);
        }
        for (let i = 0; i < 16; i++) {
            proofInput.subproofsLimbs.push(constants.MaxUint256);
        }
        const tx = await this.zkLink.proveBlocks(committedBlocks, proofInput);
        let txr = await this.zkLink.provider.getTransactionReceipt(tx.hash);
        this.totalProven += nBlocks;
        return txr.gasUsed;
    }

    async syncBlocks() {
        const sb = this.storedBlock[this.totalProven];
        // mock sync block from all other chains ( 14 = 1 << 1 | 1 << 2 | 1 << 3)
        await this.periphery.setSyncProgress(sb.syncHash, 14);
        await this.periphery.syncBlocks(sb);
    }

    async executeBlocks(nBlocks, pendingOnchainOpsPubdata) {
        const executeBlocks = [];
        for (let i = 1; i <= nBlocks; i++) {
            const sb = this.storedBlock[this.totalExecuted + i];
            executeBlocks.push({
                storedBlock:sb,
                pendingOnchainOpsPubdata:pendingOnchainOpsPubdata
            })
        }
        const tx = await this.zkLink.connect(this.validator).executeBlocks(executeBlocks);
        let txr = await this.zkLink.provider.getTransactionReceipt(tx.hash);
        this.totalExecuted += nBlocks;
        return txr.gasUsed;
    }

    async buildOpEstimateData(params) {
        const chainId = params.chainId;
        const opType = params.opType;
        let op, opPubdata, ethWitness = "0x", processable = false, isOnchainOp = true;
        if (opType === OP_DEPOSIT) {
            const opParams = {chainId:chainId,accountId:1,subAccountId:0,tokenId:this.token2Id,amount:parseEther("1"),owner:this.alice.address};
            op = getDepositPubdata(opParams);
            if (chainId === CHAIN_ID) {
                await this.zkLink.testAddPriorityRequest(opType, writeDepositPubdata(opParams));
            }
        } else if (opType === OP_FULL_EXIT) {
            const amount = params.amount;
            const owner = params.owner;
            const tokenId = params.tokenId;
            const opParams = {chainId:chainId,accountId:1,subAccountId:0,owner,tokenId,amount};
            op = getFullExitPubdata(opParams);
            if (chainId === CHAIN_ID) {
                await this.zkLink.testAddPriorityRequest(opType, writeFullExitPubdata(opParams));
                processable = true;
            }
        } else if (opType === OP_CHANGE_PUBKEY) {
            const accountId = 1;
            let pubKeyHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            let nonce = 1;
            const changePubkeyType = params.changePubkeyType;
            let owner = this.alice.address;
            if (changePubkeyType === 0) {
                ethWitness = createEthWitnessOfECRECOVER(pubKeyHash,nonce,accountId,this.alice);
            } else if (changePubkeyType === 1) {
                const saltArg = "0x1100000000000000000000000000000000000000000000000000000000000000";
                const codeHash = "0x00ff000000000000000000000000000000000000000000000000000000000000";
                const info = createEthWitnessOfCREATE2(pubKeyHash,accountId,this.alice.address,saltArg,codeHash);
                ethWitness = info.ethWitness;
                owner = info.owner;
                nonce = 0;
            } else if (changePubkeyType === 3) {
                pubKeyHash = params.pubkeyHash;
                owner = params.owner;
                nonce = params.nonce;
            }
            const opParams = {chainId:chainId,accountId,pubKeyHash,owner,nonce,tokenId:this.token2Id,fee:0};
            op = getChangePubkeyPubdata(opParams);
        } else if (opType === OP_WITHDRAW) {
            const accountId = 1;
            const amount = params.amount;
            const owner = params.owner;
            const tokenId = params.tokenId;
            let nonce = params.nonce;
            const fastWithdrawFeeRate = params.fastWithdrawFeeRate;
            if (nonce > 0 && chainId === CHAIN_ID) {
                nonce = nonce + params.i;
                const hash = calAcceptHash(owner, tokenId, amount, fastWithdrawFeeRate, nonce);
                const accepter = params.accepter;
                await this.periphery.setAccepter(accountId,hash,accepter);
            }
            const opParams = {chainId:chainId,accountId,subAccountId:0,tokenId,amount,fee:0,owner,nonce,fastWithdrawFeeRate};
            op = getWithdrawPubdata(opParams);
            if (chainId === CHAIN_ID) {
                processable = true;
            }
        } else if (opType === OP_TRANSFER) {
            op = getTransferPubdata({fromAccountId:1,fromSubAccountId:0,tokenId:this.token2Id,amount:456,toAccountId:4,toSubAccountId:3,fee:34});
            isOnchainOp = false;
        } else if (opType === OP_TRANSFER_TO_NEW) {
            op = getTransferToNewPubdata({fromAccountId:1,fromSubAccountId:0,tokenId:this.token2Id,amount:456,toAccountId:4,toSubAccountId:3,to:this.alice.address,fee:34});
            isOnchainOp = false;
        } else if (opType === OP_ORDER_MATCHING) {
            op = getOrderMatchingPubdata({submitterAccountId:1,taker:{
                    accountId:1,subAccountId:1,slotId:4,tokenId:this.token2Id,amount:4242,feeRatio:34
                },maker:{
                    accountId:2,subAccountId:1,slotId:2,tokenId:this.token2Id,amount:14242,feeRatio:134
                },feeTokenId:this.token2Id,fee:456,baseAmount:4003,quoteAmount:31231});
            isOnchainOp = false;
        }
        opPubdata = paddingChunk(op);
        return {opPubdata, ethWitness, processable, isOnchainOp};
    }

    async buildEstimateData(num, params) {
        const pubdatas = [];
        const onchainOperations = [];
        const pendingOnchainOpsPubdata = [];
        let publicDataOffset = 0;
        for (let i = 0; i < num; i++) {
            params.i = i;
            const {opPubdata, ethWitness, processable, isOnchainOp} = await this.buildOpEstimateData(params);
            pubdatas.push(opPubdata);
            if (processable) {
                pendingOnchainOpsPubdata.push(opPubdata);
            }
            if (isOnchainOp) {
                onchainOperations.push({
                    ethWitness,
                    publicDataOffset:publicDataOffset
                });
            }
            publicDataOffset += arrayify(opPubdata).length;
        }
        const publicData = hexlify(concat(pubdatas));
        return {publicData, onchainOperations, pendingOnchainOpsPubdata}
    }
}

async function estimateBlockFee(testSetUp, nBlocks, publicData, onchainOperations, pendingOnchainOpsPubdata) {
    const commitCost = await testSetUp.commitBlocks(nBlocks, publicData, onchainOperations);
    const proveCost = await testSetUp.proveBlocks(nBlocks);
    await testSetUp.syncBlocks();
    const executeCost = await testSetUp.executeBlocks(nBlocks, pendingOnchainOpsPubdata);
    return {commitCost, proveCost, executeCost};
}

async function estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost) {
    const {publicData, onchainOperations, pendingOnchainOpsPubdata} = await testSetUp.buildEstimateData(samples, params);
    const opCost = await estimateBlockFee(testSetUp, 1, publicData, onchainOperations, pendingOnchainOpsPubdata);
    const commitCost = opCost.commitCost.sub(commitBaseCost).div(BigNumber.from(samples));
    const executeCost = opCost.executeCost.sub(executeBaseCost).div(BigNumber.from(samples));
    return {commitCost, executeCost};
}

async function printContractSize() {
    // verifier
    const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
    console.log("Verifier deploy size: " + arrayify(verifierFactory.bytecode).length);
    // periphery
    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    console.log("ZkLinkPeriphery deploy size: " + arrayify(peripheryFactory.bytecode).length);
    // zkLink
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
    console.log("ZkLink deploy size: " + arrayify(zkLinkFactory.bytecode).length);
}

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    // print contracts deploy byte size
    await printContractSize();

    const testSetUp = new TestSetUp();
    await testSetUp.init();
    // warmup, init some storage slots
    await estimateBlockFee(testSetUp, 1, "0x", [], []);

    // estimate empty block
    // oneBlockGas = txBase + pubdata(oneBlock) + codeOutSideCycle + forCycle(1)
    // nBlockGas = txBase + pubdata(oneBlock * n) + codeOutSideCycle + forCycle(n)
    // costPerBlock = pubdata(oneBlock) + forCycleGas = (nBlockGas - oneBlockGas) / (n - 1)
    // baseCost(exclude costPerBlock) = oneBlockGas - costPerBlock
    const baseCost = await estimateBlockFee(testSetUp, 1, "0x", [], []);
    const nBlocks = 5;
    const nBaseCost = await estimateBlockFee(testSetUp, nBlocks, "0x", [], []);
    const commitCostPerBlock = (nBaseCost.commitCost.sub(baseCost.commitCost)).div(BigNumber.from(nBlocks - 1));
    const commitBaseCost = baseCost.commitCost.sub(commitCostPerBlock);
    console.log("CommitCostPerBlock: " + commitCostPerBlock);
    console.log("CommitBaseCost: " + commitBaseCost);

    const proveCostPerBlock = (nBaseCost.proveCost.sub(baseCost.proveCost)).div(BigNumber.from(nBlocks - 1));
    console.log("ProveCostPerBlock: " + proveCostPerBlock);
    // ProveBaseCost is not accurate when use `VerifierMock` instead of `Verifier`

    const executeCostPerBlock = (nBaseCost.executeCost.sub(baseCost.executeCost)).div(BigNumber.from(nBlocks - 1));
    const executeBaseCost = baseCost.executeCost.sub(executeCostPerBlock);
    console.log("ExecuteCostPerBlock: " + executeCostPerBlock);
    console.log("ExecuteBaseCost: " + executeBaseCost);

    // estimate deposit of current chain
    const OTHER_CHAIN_ID = 2;
    let samples, params, opCost, owner, amount, tokenId, b0, b1, totalAmount;
    samples = 100;
    params = {chainId:CHAIN_ID, opType:OP_DEPOSIT};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurDepositCommitCost: " + opCost.commitCost);
    console.log("CurDepositExecuteCost: " + opCost.executeCost);

    // estimate deposit of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherDepositCommitCost: " + opCost.commitCost);
    console.log("OtherDepositExecuteCost: " + opCost.executeCost);

    // estimate full exit erc20 of current chain
    owner = testSetUp.alice.address;
    amount = parseEther("1");
    tokenId = testSetUp.token2Id;
    params = {chainId:CHAIN_ID, opType:OP_FULL_EXIT, owner, tokenId, amount};
    b0 = await testSetUp.token2.balanceOf(owner);
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurFullExitERC20CommitCost: " + opCost.commitCost);
    console.log("CurFullExitERC20ExecuteCost: " + opCost.executeCost);
    b1 = await testSetUp.token2.balanceOf(owner);
    totalAmount = amount.mul(BigNumber.from(samples));
    if (!b1.sub(b0).eq(totalAmount)) {
        throw 'FullExit failed';
    }

    // estimate full exit eth of current chain
    tokenId = testSetUp.ethId;
    amount = parseEther("0.01");
    params = {chainId:CHAIN_ID, opType:OP_FULL_EXIT, owner, tokenId, amount};
    b0 = await testSetUp.alice.getBalance();
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurFullExitETHCommitCost: " + opCost.commitCost);
    console.log("CurFullExitETHExecuteCost: " + opCost.executeCost);
    b1 = await testSetUp.alice.getBalance();
    totalAmount = amount.mul(BigNumber.from(samples));
    if (!b1.sub(b0).eq(totalAmount)) {
        throw 'FullExit failed';
    }

    // estimate full exit of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherFullExitCommitCost: " + opCost.commitCost);
    console.log("OtherFullExitExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of ecdsa of current chain
    params = {chainId:CHAIN_ID, opType:OP_CHANGE_PUBKEY, changePubkeyType:0};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurChangePubKeyOfECDSACommitCost: " + opCost.commitCost);
    console.log("CurChangePubKeyOfECDSAExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of ecdsa of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherChangePubKeyOfECDSACommitCost: " + opCost.commitCost);
    console.log("OtherChangePubKeyOfECDSAExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of create2 of current chain
    params = {chainId:CHAIN_ID, opType:OP_CHANGE_PUBKEY, changePubkeyType:1};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurChangePubKeyOfCREATE2CommitCost: " + opCost.commitCost);
    console.log("CurChangePubKeyOfCREATE2ExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of create2 of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherChangePubKeyOfCREATE2CommitCost: " + opCost.commitCost);
    console.log("OtherChangePubKeyOfCREATE2ExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of onchain of current chain
    params = {chainId:CHAIN_ID, opType:OP_CHANGE_PUBKEY, changePubkeyType:2, pubkeyHash:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', nonce:1, owner:testSetUp.alice.address};
    await testSetUp.periphery.connect(testSetUp.alice).setAuthPubkeyHash(params.pubkeyHash, params.nonce);
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurChangePubKeyOfONCHAINCommitCost: " + opCost.commitCost);
    console.log("CurChangePubKeyOfONCHAINExecuteCost: " + opCost.executeCost);

    // estimate change pubkey of onchain of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherChangePubKeyOfONCHAINCommitCost: " + opCost.commitCost);
    console.log("OtherChangePubKeyOfONCHAINExecuteCost: " + opCost.executeCost);

    // estimate normal withdraw erc20 of current chain
    amount = parseEther("1");
    owner = testSetUp.alice.address;
    tokenId = testSetUp.token2Id;
    params = {chainId:CHAIN_ID, opType:OP_WITHDRAW, amount, owner, tokenId, nonce:0, fastWithdrawFeeRate:0};
    b0 = await testSetUp.token2.balanceOf(owner);
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurNormalWithdrawERC20CommitCost: " + opCost.commitCost);
    console.log("CurNormalWithdrawERC20ExecuteCost: " + opCost.executeCost);
    b1 = await testSetUp.token2.balanceOf(owner);
    totalAmount = amount.mul(BigNumber.from(samples));
    if (!b1.sub(b0).eq(totalAmount)) {
        throw 'Normal withdraw failed';
    }

    // estimate normal withdraw eth of current chain
    amount = parseEther("0.02");
    owner = testSetUp.alice.address;
    tokenId = testSetUp.ethId;
    params = {chainId:CHAIN_ID, opType:OP_WITHDRAW, amount, owner, tokenId, nonce:0, fastWithdrawFeeRate:0};
    b0 = await testSetUp.alice.getBalance();
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurNormalWithdrawETHCommitCost: " + opCost.commitCost);
    console.log("CurNormalWithdrawETHExecuteCost: " + opCost.executeCost);
    b1 = await testSetUp.alice.getBalance();
    totalAmount = amount.mul(BigNumber.from(samples));
    if (!b1.sub(b0).eq(totalAmount)) {
        throw 'Normal withdraw failed';
    }

    // estimate normal withdraw of other chain
    params.chainId = OTHER_CHAIN_ID;
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OtherNormalWithdrawCommitCost: " + opCost.commitCost);
    console.log("OtherNormalWithdrawExecuteCost: " + opCost.executeCost);

    // estimate fast withdraw of current chain
    amount = parseEther("2");
    owner = testSetUp.alice.address;
    tokenId = testSetUp.token2Id;
    let accepter = testSetUp.bob.address;
    params = {chainId:CHAIN_ID, opType:OP_WITHDRAW, amount, owner, tokenId, nonce:1, fastWithdrawFeeRate:50, accepter};
    b0 = await testSetUp.periphery.getPendingBalance(accepter, tokenId);
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("CurFastWithdrawCommitCost: " + opCost.commitCost);
    console.log("CurFastWithdrawExecuteCost: " + opCost.executeCost);
    b1 = await testSetUp.periphery.getPendingBalance(accepter, tokenId);
    totalAmount = amount.mul(BigNumber.from(samples));
    if (!b1.sub(b0).eq(totalAmount)) {
        throw 'Fast withdraw failed';
    }

    // commit cost of force exit is the same with withdraw
    // execute cost of force exit is the same with full exit

    // estimate transfer
    params = {chainId:CHAIN_ID, opType:OP_TRANSFER};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("TransferCommitCost: " + opCost.commitCost);
    console.log("TransferExecuteCost: " + opCost.executeCost);

    // estimate transfer to new
    params = {chainId:CHAIN_ID, opType:OP_TRANSFER_TO_NEW};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("TransferToNewCommitCost: " + opCost.commitCost);
    console.log("TransferToNewExecuteCost: " + opCost.executeCost);

    // estimate order matching
    params = {chainId:CHAIN_ID, opType:OP_ORDER_MATCHING};
    opCost = await estimateOpFee(testSetUp, samples, params, commitBaseCost, executeBaseCost);
    console.log("OrderMatchingCommitCost: " + opCost.commitCost);
    console.log("OrderMatchingExecuteCost: " + opCost.executeCost);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
