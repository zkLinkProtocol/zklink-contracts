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
    syncHashs:[]
}
const USD_TOKEN_ID = 1;
const MIN_USD_STABLE_TOKEN_ID = 17;
const MAX_USD_STABLE_TOKEN_ID = 31;
const MAX_PROOF_COMMITMENT = "0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const MAX_ACCEPT_FEE_RATE = 10000;
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
// master or slaver chain
const IS_MASTER_CHAIN = hardhat.config.solpp.defs.CHAIN_ID === hardhat.config.solpp.defs.MASTER_CHAIN_ID;
// sync type
const SYNC_TYPE = hardhat.config.solpp.defs.SYNC_TYPE;

async function deploy() {
    const [defaultSender,governor,validator,alice,bob] = await hardhat.ethers.getSigners();
    // verifier
    const verifierFactory = await hardhat.ethers.getContractFactory('VerifierMock');
    const verifier = await verifierFactory.deploy();

    // periphery
    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeripheryTest');
    const periphery = await peripheryFactory.deploy();
    // zkLink
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
    const zkLink = await zkLinkFactory.deploy(periphery.target);

    // deploy proxy
    const proxyFactory = await hardhat.ethers.getContractFactory('Proxy');
    const verifyProxy = await proxyFactory.deploy(verifier.target, "0x");
    const verifyContract = verifierFactory.attach(verifyProxy.target);
    const abiCoder = new hardhat.ethers.AbiCoder();
    const zkLinkInitParams = IS_MASTER_CHAIN ?
          abiCoder.encode(['address','address', 'bytes32'], [verifyProxy.target, governor.address, GENESIS_ROOT]) :
          abiCoder.encode(['address','address', 'uint32'], [verifyProxy.target, governor.address, 0]);
    const zkLinkProxy = await proxyFactory.deploy(zkLink.target, zkLinkInitParams);
    const zkLinkContract = zkLinkFactory.attach(zkLinkProxy.target);
    const peripheryContract = peripheryFactory.attach(zkLinkProxy.target);

    // deploy upgradeGatekeeper
    const upgradeGatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
    const upgradeGatekeeper = await upgradeGatekeeperFactory.connect(governor).deploy(zkLinkProxy.target);

    // transfer master ship of proxy
    await verifyProxy.transferMastership(upgradeGatekeeper.target);
    await zkLinkProxy.transferMastership(upgradeGatekeeper.target);

    // add upgradeable
    await upgradeGatekeeper.connect(governor).addUpgradeable(verifyProxy.target);
    await upgradeGatekeeper.connect(governor).addUpgradeable(zkLinkProxy.target);

    // set validator
    await peripheryContract.connect(governor).setValidator(validator.address, true);

    // add some tokens
    const ethId = 33;
    const ethAddress = ETH_ADDRESS;
    await peripheryContract.connect(governor).addToken(ethId, ethAddress, 18);

    const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
    const token2 = await stFactory.deploy("Token2", "T2");
    const token2Id = 34;
    await peripheryContract.connect(governor).addToken(token2Id, token2.target, 18);

    const token4 = await stFactory.deploy("Token4", "T4");
    const token4Id = 17;
    await peripheryContract.connect(governor).addToken(token4Id, token4.target, 18);

    const stdFactory = await hardhat.ethers.getContractFactory('StandardTokenWithDecimals');
    const token5 = await stdFactory.deploy("Token5", "T5", 6);
    const token5Id = 36;
    await peripheryContract.connect(governor).addToken(token5Id, token5.target, 6);

    // L2 gateway
    const gatewayFactory = await hardhat.ethers.getContractFactory('L2GatewayMock');
    const gateway = await gatewayFactory.deploy();

    return {
        zkLink: zkLinkContract,
        periphery: peripheryContract,
        verifier: verifyContract,
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
    return hardhat.ethers.keccak256(hardhat.ethers.solidityPacked(["bytes32","uint32","bytes32","bytes32"],
        [preBlockSyncHash, newBlockBlockNumber, newBlockStateHash, onchainOperationPubdataHash]));
}

module.exports = {
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
    ETH_ADDRESS,
    SYNC_TYPE
};
