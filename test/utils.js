const hardhat = require("hardhat");
const {keccak256, solidityPack} = require("ethers/lib/utils");
const ethers = hardhat.ethers;

const OP_NOOP = 0;
const OP_DEPOSIT = 1;
const OP_TRANSFER_TO_NEW = 2;
const OP_WITHDRAW = 3;
const OP_TRANSFER = 4;
const OP_FULL_EXIT = 5;
const OP_CHANGE_PUBKEY = 6;
const OP_FORCE_EXIT = 7;
const OP_ORDER_MATCHING = 11;
const CHUNK_BYTES = 14;
const MIN_CHAIN_ID = 1;
const MAX_CHAIN_ID = 4;
const CHAIN_ID = 1; // chain id of UnitTest env
const COMMIT_TIMESTAMP_NOT_OLDER = 86400; // 24 hours
const COMMIT_TIMESTAMP_APPROXIMATION_DELTA = 900; // 15 minutes
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const EMPTY_STRING_KECCAK = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
const GENESIS_ROOT = "0x209d742ecb062db488d20e7f8968a40673d718b24900ede8035e05a78351d956";
const GENESIS_BLOCK = {
    blockNumber:0,
    priorityOperations:0,
    pendingOnchainOperationsHash:EMPTY_STRING_KECCAK,
    timestamp:0,
    stateHash:GENESIS_ROOT,
    commitment:ZERO_BYTES32,
    syncHash:EMPTY_STRING_KECCAK
}

function getDepositPubdata({ chainId, accountId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","address"],
        [OP_DEPOSIT,chainId,accountId,subAccountId,tokenId,amount,owner]);
}

function writeDepositPubdata({ chainId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","address"],
        [OP_DEPOSIT,chainId,0,subAccountId,tokenId,amount,owner]);
}

function getWithdrawPubdata({ chainId, accountId, subAccountId, tokenId, amount, fee, owner, nonce, fastWithdrawFeeRate }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","uint16","address","uint32","uint16"],
        [OP_WITHDRAW,chainId,accountId,subAccountId,tokenId,amount,fee,owner,nonce,fastWithdrawFeeRate]);
}

function getFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId, amount}) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","address","uint16","uint128"],
        [OP_FULL_EXIT,chainId,accountId,subAccountId,owner,tokenId,amount]);
}

function writeFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId}) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","address","uint16","uint128"],
        [OP_FULL_EXIT,chainId,accountId,subAccountId,owner,tokenId,0]);
}

function getForcedExitPubdata({ chainId, initiatorAccountId, targetAccountId, targetSubAccountId, tokenId, amount, fee, target }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint32","uint8","uint16","uint128","uint16","address"],
        [OP_FORCE_EXIT,chainId,initiatorAccountId,targetAccountId,targetSubAccountId,tokenId,amount,fee,target]);
}

function getChangePubkeyPubdata({ chainId, accountId, pubKeyHash, owner, nonce, tokenId, fee}) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","bytes20","address","uint32","uint16","uint16"],
        [OP_CHANGE_PUBKEY,chainId,accountId,pubKeyHash,owner,nonce,tokenId,fee]);
}

function getTransferPubdata({fromAccountId, fromSubAccountId, tokenId, amount, toAccountId, toSubAccountId, fee}) {
    return ethers.utils.solidityPack(["uint8","uint32","uint8","uint16","uint40","uint32","uint8","uint16"],
        [OP_TRANSFER,fromAccountId,fromSubAccountId,tokenId,amount,toAccountId,toSubAccountId,fee]);
}

function getTransferToNewPubdata({fromAccountId, fromSubAccountId, tokenId, amount, toAccountId, toSubAccountId, to, fee}) {
    return ethers.utils.solidityPack(["uint8","uint32","uint8","uint16","uint40","uint32","uint8","address","uint16"],
        [OP_TRANSFER_TO_NEW,fromAccountId,fromSubAccountId,tokenId,amount,toAccountId,toSubAccountId,to,fee]);
}

function getOrderMatchingPubdata({submitterAccountId, taker, maker, feeTokenId, fee, baseAmount, quoteAmount}) {
    // subAccountId of taker and maker must be the same
    const takerBytes = ethers.utils.solidityPack(["uint32","uint8","uint16","uint40","uint8"],
        [taker.accountId,taker.slotId,taker.tokenId,taker.amount,taker.feeRatio]);
    const makerBytes = ethers.utils.solidityPack(["uint32","uint8","uint8","uint16","uint40","uint8"],
        [maker.accountId,maker.subAccountId,maker.slotId,maker.tokenId,maker.amount,maker.feeRatio]);
    return ethers.utils.solidityPack(["uint8","uint32","bytes","bytes","uint16","uint16","uint128","uint128"],
        [OP_ORDER_MATCHING,submitterAccountId,takerBytes,makerBytes,feeTokenId,fee,baseAmount,quoteAmount]);
}

function mockNoopPubdata() {
    return ethers.utils.solidityPack(["uint8"], [OP_NOOP]);
}

function paddingChunk(pubdata) {
    const pubdataArray = ethers.utils.arrayify(pubdata);
    const zeroPaddingNum = CHUNK_BYTES - pubdataArray.length % CHUNK_BYTES;
    const zeroArray = new Uint8Array(zeroPaddingNum);
    const pubdataPaddingArray = ethers.utils.concat([pubdataArray, zeroArray]);
    return ethers.utils.hexlify(pubdataPaddingArray);
}

async function calFee(tx) {
    let gasPrice = tx.gasPrice;
    let txr = await ethers.provider.getTransactionReceipt(tx.hash);
    let gasUsed = txr.gasUsed;
    return ethers.BigNumber.from(gasPrice).mul(ethers.BigNumber.from(gasUsed));
}

async function deploy() {
    const [defaultSender,governor,validator,feeAccount,alice,bob] = await hardhat.ethers.getSigners();
    // verifier
    const verifierFactory = await hardhat.ethers.getContractFactory('VerifierMock');
    const verifier = await verifierFactory.deploy();
    // periphery
    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeripheryTest');
    const periphery = await peripheryFactory.deploy();
    // zkLink
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
    const zkLink = await zkLinkFactory.deploy();

    const genesisRoot = hardhat.ethers.utils.arrayify(GENESIS_ROOT);

    // deployer
    const deployerFactory = await hardhat.ethers.getContractFactory('DeployFactory');
    const deployer = await deployerFactory.deploy(
        verifier.address,
        zkLink.address,
        periphery.address,
        genesisRoot,
        validator.address,
        governor.address,
        feeAccount.address
    );
    const txr = await deployer.deployTransaction.wait();
    const log = deployer.interface.parseLog(txr.logs[2]);
    const verifyProxy = verifierFactory.attach(log.args.verifier);
    const zkLinkProxy = zkLinkFactory.attach(log.args.zkLink);
    const peripheryProxy = peripheryFactory.attach(log.args.zkLink);
    const upgradeGatekeeper = log.args.upgradeGatekeeper;

    // add some tokens
    const ethId = 1;
    const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    await peripheryProxy.connect(governor).addToken(ethId, ethAddress);

    const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
    const token2 = await stFactory.deploy("Token2", "T2");
    await peripheryProxy.connect(governor).addToken(2, token2.address);

    const nstFactory = await hardhat.ethers.getContractFactory('NonStandardToken');
    const token3 = await nstFactory.deploy("Token3", "T3");
    await peripheryProxy.connect(governor).addToken(3, token3.address);

    return {
        zkLink: zkLinkProxy,
        periphery: peripheryProxy,
        verifier: verifyProxy,
        upgradeGatekeeper: upgradeGatekeeper,
        governor: governor,
        validator: validator,
        defaultSender: defaultSender,
        alice: alice,
        bob: bob,
        eth: {
            tokenId: ethId,
            tokenAddress: ethAddress
        },
        token2: {
            tokenId: 2,
            contract: token2,
        },
        token3: {
            tokenId: 3,
            contract: token3,
        }
    }
}

function hashBytesToBytes20(pubData) {
    return ethers.utils.hexlify(ethers.utils.arrayify(ethers.utils.keccak256(pubData)).slice(12));
}

async function createEthWitnessOfECRECOVER(pubKeyHash,nonce,accountId,owner) {
    const sigMsg = ethers.utils.solidityPack(
        ["bytes20","uint32","uint32","bytes32"],
        [pubKeyHash,nonce,accountId,ZERO_BYTES32]);
    const signature = await owner.signMessage(ethers.utils.arrayify(sigMsg));
    return ethers.utils.solidityPack(["bytes1","bytes"],[0, signature]);
}

function createEthWitnessOfCREATE2(pubKeyHash,accountId,creatorAddress,saltArg,codeHash) {
    const ethWitness = ethers.utils.solidityPack(["bytes1","address","bytes32","bytes32"],[1, creatorAddress, saltArg, codeHash]);
    const salt = ethers.utils.keccak256(ethers.utils.arrayify(ethers.utils.solidityPack(["bytes32","bytes20"],[saltArg, pubKeyHash])));
    const owner = ethers.utils.getCreate2Address(creatorAddress, ethers.utils.arrayify(salt), ethers.utils.arrayify(codeHash));
    return {ethWitness, owner};
}

function calAcceptHash(receiver, tokenId, amount, withdrawFeeRate, nonce) {
    return  keccak256(solidityPack(["address","uint16","uint128","uint16","uint32"], [receiver, tokenId, amount, withdrawFeeRate, nonce]));
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

module.exports = {
    getDepositPubdata,
    writeDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    writeFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata,
    getTransferPubdata,
    getTransferToNewPubdata,
    getOrderMatchingPubdata,
    mockNoopPubdata,
    paddingChunk,
    calFee,
    deploy,
    hashBytesToBytes20,
    createEthWitnessOfECRECOVER,
    createEthWitnessOfCREATE2,
    calAcceptHash,
    getRandomInt,
    OP_DEPOSIT,
    OP_WITHDRAW,
    OP_FULL_EXIT,
    OP_FORCE_EXIT,
    OP_CHANGE_PUBKEY,
    OP_TRANSFER,
    OP_TRANSFER_TO_NEW,
    OP_ORDER_MATCHING,
    CHUNK_BYTES,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    COMMIT_TIMESTAMP_NOT_OLDER,
    COMMIT_TIMESTAMP_APPROXIMATION_DELTA,
    ZERO_BYTES32,
    EMPTY_STRING_KECCAK,
    GENESIS_ROOT,
    GENESIS_BLOCK
};
