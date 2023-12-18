const ethers = require("ethers");
const {arrayify,hexlify,concat} = require("@ethersproject/bytes")

const OP_NOOP = 0;
const OP_DEPOSIT = 1;
const OP_TRANSFER_TO_NEW = 2;
const OP_WITHDRAW = 3;
const OP_TRANSFER = 4;
const OP_FULL_EXIT = 5;
const OP_CHANGE_PUBKEY = 6;
const OP_FORCE_EXIT = 7;
const OP_ORDER_MATCHING = 11;
const CHUNK_BYTES = 23;
const OP_NOOP_CHUNKS = 1;
const OP_DEPOSIT_CHUNKS = 3;
const OP_TRANSFER_TO_NEW_CHUNKS = 3;
const OP_WITHDRAW_CHUNKS = 3;
const OP_TRANSFER_CHUNKS = 2;
const OP_FULL_EXIT_CHUNKS = 3;
const OP_CHANGE_PUBKEY_CHUNKS = 3;
const OP_FORCE_EXIT_CHUNKS = 3;
const OP_ORDER_MATCHING_CHUNKS = 4;
const OP_DEPOSIT_SIZE = 59;
const OP_TRANSFER_TO_NEW_SIZE = 52;
const OP_WITHDRAW_SIZE = 68;
const OP_TRANSFER_SIZE = 20;
const OP_FULL_EXIT_SIZE = 59;
const OP_CHANGE_PUBKEY_SIZE = 67;
const OP_FORCE_EXIT_SIZE = 69;
const OP_ORDER_MATCHING_SIZE = 77;
const OP_DEPOSIT_HASH_SIZE = 55;
const OP_FULLEXIT_HASH_SIZE = 43;
const ADDRESS_PREFIX_ZERO_BYTES = "0x000000000000000000000000";

function getDepositPubdata({ chainId, accountId, subAccountId, tokenId, targetTokenId, amount, owner }) {
    const pubdata = ethers.solidityPacked(["uint8","uint8","uint8","uint16","uint16","uint128","bytes32","uint32"],
        [OP_DEPOSIT,chainId,subAccountId,tokenId,targetTokenId,amount,owner,accountId]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_DEPOSIT_SIZE, "wrong deposit pubdata");
    return pubdata;
}

function writeDepositPubdata({ chainId, subAccountId, tokenId, targetTokenId, amount, owner }) {
    return ethers.solidityPacked(["uint8","uint8","uint8","uint16","uint16","uint128","bytes32","uint32"],
        [OP_DEPOSIT,chainId,subAccountId,tokenId,targetTokenId,amount,owner,0]);
}

function getWithdrawPubdata({ chainId, accountId, subAccountId, tokenId, srcTokenId, amount, fee, owner, nonce, fastWithdrawFeeRate, withdrawToL1 }) {
    const pubdata = ethers.solidityPacked(["uint8","uint8","uint32","uint8","uint16","uint16","uint128","uint16","bytes32","uint32","uint16","uint8"],
        [OP_WITHDRAW,chainId,accountId,subAccountId,tokenId,srcTokenId,amount,fee,owner,nonce,fastWithdrawFeeRate,withdrawToL1]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_WITHDRAW_SIZE, "wrong withdraw pubdata");
    return pubdata;
}

function getFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId, srcTokenId, amount}) {
    const pubdata = ethers.solidityPacked(["uint8","uint8","uint32","uint8","bytes32","uint16","uint16","uint128"],
        [OP_FULL_EXIT,chainId,accountId,subAccountId,owner,tokenId,srcTokenId,amount]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_FULL_EXIT_SIZE, "wrong fullexit pubdata");
    return pubdata;
}

function writeFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId, srcTokenId}) {
    return ethers.solidityPacked(["uint8","uint8","uint32","uint8","bytes32","uint16","uint16","uint128"],
        [OP_FULL_EXIT,chainId,accountId,subAccountId,owner,tokenId,srcTokenId,0]);
}

function getForcedExitPubdata({ chainId, initiatorAccountId, initiatorSubAccountId, initiatorNonce, targetAccountId, targetSubAccountId, tokenId, srcTokenId, amount, withdrawToL1, target }) {
    const pubdata = ethers.solidityPacked(["uint8","uint8","uint32","uint8","uint32","uint32","uint8","uint16","uint16","uint128","uint8","bytes32"],
        [OP_FORCE_EXIT,chainId,initiatorAccountId,initiatorSubAccountId,initiatorNonce,targetAccountId,targetSubAccountId,tokenId,srcTokenId,amount,withdrawToL1,target]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_FORCE_EXIT_SIZE, "wrong forcedexit pubdata");
    return pubdata;
}

function getChangePubkeyPubdata({ chainId, accountId, subAccountId, pubKeyHash, owner, nonce, tokenId, fee}) {
    const pubdata = ethers.solidityPacked(["uint8","uint8","uint32","uint8","bytes20","bytes32","uint32","uint16","uint16"],
        [OP_CHANGE_PUBKEY,chainId,accountId,subAccountId,pubKeyHash,owner,nonce,tokenId,fee]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_CHANGE_PUBKEY_SIZE, "wrong changepubkey pubdata");
    return pubdata;
}

function getTransferPubdata({fromAccountId, fromSubAccountId, tokenId, amount, toAccountId, toSubAccountId, fee}) {
    const pubdata = ethers.solidityPacked(["uint8","uint32","uint8","uint16","uint40","uint32","uint8","uint16"],
        [OP_TRANSFER,fromAccountId,fromSubAccountId,tokenId,amount,toAccountId,toSubAccountId,fee]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_TRANSFER_SIZE, "wrong transfer pubdata");
    return pubdata;
}

function getTransferToNewPubdata({fromAccountId, fromSubAccountId, tokenId, amount, toAccountId, toSubAccountId, to, fee}) {
    const pubdata = ethers.solidityPacked(["uint8","uint32","uint8","uint16","uint40","bytes32","uint32","uint8","uint16"],
        [OP_TRANSFER_TO_NEW,fromAccountId,fromSubAccountId,tokenId,amount,to,toAccountId,toSubAccountId,fee]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_TRANSFER_TO_NEW_SIZE, "wrong transfertonew pubdata");
    return pubdata;
}

function getOrderMatchingPubdata({submitterAccountId, taker, maker, feeTokenId, fee, baseAmount, quoteAmount}) {
    const pubdata =  ethers.solidityPacked(["uint8",
            "uint8",
            "uint32","uint32","uint32",
            "uint16","uint16",
            "uint16","uint16","uint16",
            "uint40","uint40",
            "uint16",
            "uint8","uint8",
            "uint128","uint128",
            "uint24","uint24",
            "uint8"
        ],
        [OP_ORDER_MATCHING,
            maker.subAccountId,
            maker.accountId,taker.accountId,submitterAccountId,
            maker.slotId,taker.slotId,
            maker.tokenId,taker.tokenId,feeTokenId,
            maker.amount,taker.amount,
            fee,
            maker.feeRatio,taker.feeRatio,
            baseAmount,quoteAmount,
            maker.nonce,taker.nonce,
            maker.is_sell
        ]);
    const pubdataArray = arrayify(pubdata);
    console.assert(pubdataArray.length === OP_ORDER_MATCHING_SIZE, "wrong ordermatching pubdata");
    return pubdata;
}

function mockNoopPubdata() {
    return ethers.solidityPacked(["uint8"], [OP_NOOP]);
}

function paddingChunk(pubdata, chunks) {
    const pubdataArray = arrayify(pubdata);
    const zeroPaddingNum = CHUNK_BYTES * chunks - pubdataArray.length;
    const zeroArray = new Uint8Array(zeroPaddingNum);
    const pubdataPaddingArray = concat([pubdataArray, zeroArray]);
    return hexlify(pubdataPaddingArray);
}

function extendAddress(address) {
    const addrBytes = arrayify(address);
    const zeroBytes = arrayify(ADDRESS_PREFIX_ZERO_BYTES);
    const extendAddrArray = concat([zeroBytes, addrBytes]);
    return hexlify(extendAddrArray);
}

function hashBytesToBytes20(pubData) {
    return hexlify(arrayify(ethers.keccak256(pubData)).slice(12));
}

async function createEthWitnessOfECRECOVER(pubKeyHash,nonce,accountId,owner) {
    const sigMsg = ethers.solidityPacked(
        ["string"],
        ["ChangePubKey\nPubKeyHash: " + pubKeyHash + "\nNonce: " + nonce + "\nAccountId: " + accountId]);
    const signature = await owner.signMessage(arrayify(sigMsg));
    return ethers.solidityPacked(["bytes1","bytes"],['0x00', signature]);
}

function createEthWitnessOfCREATE2(pubKeyHash,accountId,creatorAddress,saltArg,codeHash) {
    const ethWitness = ethers.solidityPacked(["bytes1","address","bytes32","bytes32"],["0x01", creatorAddress, saltArg, codeHash]);
    const salt = ethers.keccak256(arrayify(ethers.solidityPacked(["bytes32","bytes20"],[saltArg, pubKeyHash])));
    const owner = ethers.getCreate2Address(creatorAddress, arrayify(salt), arrayify(codeHash));
    return {ethWitness, owner};
}

function calWithdrawHash(receiver, token, amount, fastWithdrawFeeRate, accountIdOfNonce, subAccountIdOfNonce, nonce) {
    return  ethers.keccak256(ethers.solidityPacked(["uint32","uint8","uint32", "address","address","uint128","uint16"], [accountIdOfNonce, subAccountIdOfNonce, nonce, receiver, token, amount, fastWithdrawFeeRate]));
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
    extendAddress,
    hashBytesToBytes20,
    createEthWitnessOfECRECOVER,
    createEthWitnessOfCREATE2,
    calWithdrawHash,
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
    OP_NOOP_CHUNKS,
    OP_DEPOSIT_CHUNKS,
    OP_TRANSFER_TO_NEW_CHUNKS,
    OP_WITHDRAW_CHUNKS,
    OP_TRANSFER_CHUNKS,
    OP_FULL_EXIT_CHUNKS,
    OP_CHANGE_PUBKEY_CHUNKS,
    OP_FORCE_EXIT_CHUNKS,
    OP_ORDER_MATCHING_CHUNKS,
    OP_DEPOSIT_HASH_SIZE,
    OP_FULLEXIT_HASH_SIZE
};
