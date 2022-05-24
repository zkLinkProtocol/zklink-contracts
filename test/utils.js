const hardhat = require("hardhat");
const ethers = hardhat.ethers;

const OP_NOOP = 0;
const OP_DEPOSIT = 1;
const OP_WITHDRAW = 3;
const OP_TRANSFER = 4;
const OP_FULL_EXIT = 5;
const OP_CHANGE_PUBKEY = 6;
const OP_FORCE_EXIT = 7;
const CHUNK_BYTES = 14;
const MIN_CHAIN_ID = 1;
const MAX_CHAIN_ID = 4;
const CHAIN_ID = 1; // chain id of UnitTest env
const COMMIT_TIMESTAMP_NOT_OLDER = 86400; // 24 hours
const COMMIT_TIMESTAMP_APPROXIMATION_DELTA = 900; // 15 minutes
const EMPTY_STRING_KECCAK = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
const GENESIS_ROOT = "0x209d742ecb062db488d20e7f8968a40673d718b24900ede8035e05a78351d956";

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

function mockTransferPubdata({from, to, token, amount}) {
    return ethers.utils.solidityPack(["uint8","address","address","uint16","uint128"],
        [OP_TRANSFER,from,to,token,amount]);
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
    // governance
    const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
    const governance = await governanceFactory.deploy();
    // verifier
    const verifierFactory = await hardhat.ethers.getContractFactory('VerifierMock');
    const verifier = await verifierFactory.deploy();
    // periphery
    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeripheryTest');
    const periphery = await peripheryFactory.deploy();
    // zkLink
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
    const zkLink = await zkLinkFactory.deploy();

    const genesisRoot = hardhat.ethers.utils.arrayify("0x209d742ecb062db488d20e7f8968a40673d718b24900ede8035e05a78351d956");

    // deployer
    const deployerFactory = await hardhat.ethers.getContractFactory('DeployFactory');
    const deployer = await deployerFactory.deploy(
        governance.address,
        verifier.address,
        periphery.address,
        zkLink.address,
        genesisRoot,
        validator.address,
        governor.address,
        feeAccount.address
    );
    const txr = await deployer.deployTransaction.wait();
    const log = deployer.interface.parseLog(txr.logs[4]);
    const governanceProxy = governanceFactory.attach(log.args.governance);
    const zkLinkProxy = zkLinkFactory.attach(log.args.zkLink);
    const verifierProxy = verifierFactory.attach(log.args.verifier);
    const peripheryProxy = peripheryFactory.attach(log.args.periphery);
    const upgradeGatekeeper = log.args.upgradeGatekeeper;

    // add validator
    await governanceProxy.connect(governor).setValidator(validator.address, true);

    // add some tokens
    const ethId = 1;
    const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    await governanceProxy.connect(governor).addToken(ethId, ethAddress);

    const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
    const token2 = await stFactory.deploy("Token2", "T2");
    await governanceProxy.connect(governor).addToken(2, token2.address);

    const nstFactory = await hardhat.ethers.getContractFactory('NonStandardToken');
    const token3 = await nstFactory.deploy("Token3", "T3");
    await governanceProxy.connect(governor).addToken(3, token3.address);

    return {
        governance: governanceProxy,
        zkLink: zkLinkProxy,
        verifier: verifierProxy,
        periphery: peripheryProxy,
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
        [pubKeyHash,nonce,accountId,'0x0000000000000000000000000000000000000000000000000000000000000000']);
    const signature = await owner.signMessage(ethers.utils.arrayify(sigMsg));
    return ethers.utils.solidityPack(["bytes1","bytes"],[0, signature]);
}

module.exports = {
    getDepositPubdata,
    writeDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    writeFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata,
    mockTransferPubdata,
    mockNoopPubdata,
    paddingChunk,
    calFee,
    deploy,
    hashBytesToBytes20,
    createEthWitnessOfECRECOVER,
    OP_DEPOSIT,
    OP_WITHDRAW,
    OP_FULL_EXIT,
    OP_FORCE_EXIT,
    OP_CHANGE_PUBKEY,
    CHUNK_BYTES,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    COMMIT_TIMESTAMP_NOT_OLDER,
    COMMIT_TIMESTAMP_APPROXIMATION_DELTA,
    EMPTY_STRING_KECCAK,
    GENESIS_ROOT
};
