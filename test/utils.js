const hardhat = require("hardhat");

const MAX_ACCOUNT_ID = 16777215;
const MAX_SUB_ACCOUNT_ID = 31;
const MIN_CHAIN_ID = 1;
const MAX_CHAIN_ID = hardhat.config.solpp.defs.MAX_CHAIN_ID;
const CHAIN_ID = hardhat.config.solpp.defs.CHAIN_ID;
const ALL_CHAINS = hardhat.config.solpp.defs.ALL_CHAINS;
const FEE_ACCOUNT_ADDRESS = "0x740f4464a56abe0294067f890d32c599bb0ccf0d";
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
const USD_TOKEN_ID = 1;
const MIN_USD_STABLE_TOKEN_ID = 17;
const MAX_USD_STABLE_TOKEN_ID = 31;
const MAX_PROOF_COMMITMENT = "0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const MAX_ACCEPT_FEE_RATE = 10000;
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
// master or slaver chain
const IS_MASTER_CHAIN = hardhat.config.solpp.defs.CHAIN_ID === hardhat.config.solpp.defs.MASTER_CHAIN_ID;

async function calFee(tx) {
    let gasPrice = tx.gasPrice;
    let txr = await hardhat.ethers.provider.getTransactionReceipt(tx.hash);
    let gasUsed = txr.gasUsed;
    return hardhat.ethers.BigNumber.from(gasPrice).mul(hardhat.ethers.BigNumber.from(gasUsed));
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
    const zkLink = await zkLinkFactory.deploy(periphery.address);

    // deployer
    const deployerFactory = await hardhat.ethers.getContractFactory('DeployFactory');
    const zkLinkInitParams = IS_MASTER_CHAIN ?
        hardhat.ethers.utils.defaultAbiCoder.encode(["bytes32"], [GENESIS_ROOT]) :
        hardhat.ethers.utils.defaultAbiCoder.encode(["uint32"], [0]);
    const deployer = await deployerFactory.deploy(
        verifier.address,
        zkLink.address,
        zkLinkInitParams,
        validator.address,
        governor.address,
        feeAccount.address
    );
    const txr = await deployer.deployTransaction.wait();
    const log = deployer.interface.parseLog(txr.logs[0]);
    const verifyProxy = verifierFactory.attach(log.args.verifier);
    const zkLinkProxy = zkLinkFactory.attach(log.args.zkLink);
    const peripheryProxy = peripheryFactory.attach(log.args.zkLink);
    const upgradeGatekeeper = log.args.upgradeGatekeeper;

    // add some tokens
    const ethId = 33;
    const ethAddress = ETH_ADDRESS;
    await peripheryProxy.connect(governor).addToken(ethId, ethAddress, 18);

    const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
    const token2 = await stFactory.deploy("Token2", "T2");
    const token2Id = 34;
    await peripheryProxy.connect(governor).addToken(token2Id, token2.address, 18);

    const token4 = await stFactory.deploy("Token4", "T4");
    const token4Id = 17;
    await peripheryProxy.connect(governor).addToken(token4Id, token4.address, 18);

    const stdFactory = await hardhat.ethers.getContractFactory('StandardTokenWithDecimals');
    const token5 = await stdFactory.deploy("Token5", "T5", 6);
    const token5Id = 36;
    await peripheryProxy.connect(governor).addToken(token5Id, token5.address, 6);

    // L2 gateway
    const gatewayFactory = await hardhat.ethers.getContractFactory('L2GatewayMock');
    const gateway = await gatewayFactory.deploy();

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
            tokenAddress: ethAddress,
        },
        token2: {
            tokenId: token2Id,
            contract: token2,
        },
        token4: {
            tokenId: token4Id,
            contract: token4,
        },
        token5: {
            tokenId: token5Id,
            contract: token5,
        },
        gateway: gateway
    }
}

function createSlaverChainSyncHash(preBlockSyncHash, newBlockBlockNumber, newBlockStateHash, onchainOperationPubdataHash) {
    return hardhat.ethers.utils.keccak256(hardhat.ethers.utils.solidityPack(["bytes32","uint32","bytes32","bytes32"],
        [preBlockSyncHash, newBlockBlockNumber, newBlockStateHash, onchainOperationPubdataHash]));
}

module.exports = {
    calFee,
    deploy,
    createSlaverChainSyncHash,
    IS_MASTER_CHAIN,
    MAX_ACCOUNT_ID,
    MAX_SUB_ACCOUNT_ID,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    ALL_CHAINS,
    FEE_ACCOUNT_ADDRESS,
    ZERO_BYTES32,
    EMPTY_STRING_KECCAK,
    GENESIS_ROOT,
    GENESIS_BLOCK,
    USD_TOKEN_ID,
    MIN_USD_STABLE_TOKEN_ID,
    MAX_USD_STABLE_TOKEN_ID,
    MAX_PROOF_COMMITMENT,
    MAX_ACCEPT_FEE_RATE,
    ETH_ADDRESS
};
