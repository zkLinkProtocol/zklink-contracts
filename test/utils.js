const hardhat = require("hardhat");

const MAX_ACCOUNT_ID = 16777215;
const MAX_SUB_ACCOUNT_ID = 31;
const MIN_CHAIN_ID = 1;
const MAX_CHAIN_ID = 4;
const CHAIN_ID = 1; // chain id of UnitTest env
const CHAIN_ID_INDEX = 1;
const ALL_CHAINS = 15;
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
    hardhat.config.solpp.defs.PERIPHERY_ADDRESS = periphery.address;
    console.log(`set PERIPHERY_ADDRESS to ${periphery.address} and compile contracts...`);
    await hardhat.run(`compile`);
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLinkTest');
    const zkLink = await zkLinkFactory.deploy();

    // deployer
    const deployerFactory = await hardhat.ethers.getContractFactory('DeployFactory');
    const deployer = await deployerFactory.deploy(
        verifier.address,
        zkLink.address,
        0, // blockNumber
        0, // timestamp
        hardhat.ethers.utils.arrayify(GENESIS_ROOT), // stateHash
        hardhat.ethers.utils.arrayify(ZERO_BYTES32), // commitment
        hardhat.ethers.utils.arrayify(EMPTY_STRING_KECCAK), // syncHash
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
    const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    await peripheryProxy.connect(governor).addToken(ethId, ethAddress, 18, true);

    const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
    const token2 = await stFactory.deploy("Token2", "T2");
    const token2Id = 34;
    await peripheryProxy.connect(governor).addToken(token2Id, token2.address, 18, true);

    const nstFactory = await hardhat.ethers.getContractFactory('NonStandardToken');
    const token3 = await nstFactory.deploy("Token3", "T3");
    const token3Id = 35;
    await peripheryProxy.connect(governor).addToken(token3Id, token3.address, 18, false);

    const token4 = await stFactory.deploy("Token4", "T4");
    const token4Id = 17;
    await peripheryProxy.connect(governor).addToken(token4Id, token4.address, 18, true);

    const stdFactory = await hardhat.ethers.getContractFactory('StandardTokenWithDecimals');
    const token5 = await stdFactory.deploy("Token5", "T5", 6);
    const token5Id = 36;
    await peripheryProxy.connect(governor).addToken(token5Id, token5.address, 6, true);

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
        token3: {
            tokenId: token3Id,
            contract: token3,
        },
        token4: {
            tokenId: token4Id,
            contract: token4,
        },
        token5: {
            tokenId: token5Id,
            contract: token5,
        }
    }
}

module.exports = {
    calFee,
    deploy,
    MAX_ACCOUNT_ID,
    MAX_SUB_ACCOUNT_ID,
    MIN_CHAIN_ID,
    MAX_CHAIN_ID,
    CHAIN_ID,
    CHAIN_ID_INDEX,
    ALL_CHAINS,
    FEE_ACCOUNT_ADDRESS,
    ZERO_BYTES32,
    EMPTY_STRING_KECCAK,
    GENESIS_ROOT,
    GENESIS_BLOCK,
    USD_TOKEN_ID,
    MIN_USD_STABLE_TOKEN_ID,
    MAX_USD_STABLE_TOKEN_ID,
    MAX_PROOF_COMMITMENT
};
