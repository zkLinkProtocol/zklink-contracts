const hardhat = require("hardhat");
const ethers = hardhat.ethers;

function getDepositPubdata({ chainId, accountId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","address"],
        [1,chainId,accountId,subAccountId,tokenId,amount,owner]);
}

function writeDepositPubdata({ chainId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","address"],
        [1,chainId,0,subAccountId,tokenId,amount,owner]);
}

function getWithdrawPubdata({ chainId, accountId, subAccountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFeeRate }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","uint16","uint128","uint16","address","uint32","bool","uint16"],
        [3,chainId,accountId,subAccountId,tokenId,amount,fee,owner,nonce,isFastWithdraw,fastWithdrawFeeRate]);
}

function getFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId, amount}) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint8","address","uint16","uint128"],
        [5,chainId,accountId,subAccountId,owner,tokenId,amount]);
}

function getForcedExitPubdata({ chainId, initiatorAccountId, targetAccountId, targetSubAccountId, tokenId, amount, fee, target }) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","uint32","uint8","uint16","uint128","uint16","address"],
        [7,chainId,initiatorAccountId,targetAccountId,targetSubAccountId,tokenId,amount,fee,target]);
}

function getChangePubkeyPubdata({ chainId, accountId, pubKeyHash, owner, nonce, tokenId, fee}) {
    return ethers.utils.solidityPack(["uint8","uint8","uint32","bytes20","address","uint32","uint16","uint16"],
        [6,chainId,accountId,pubKeyHash,owner,nonce,tokenId,fee]);
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
    const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
    const verifier = await verifierFactory.deploy();
    // periphery
    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
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
    const verifierProxy = zkLinkFactory.attach(log.args.verifier);
    const peripheryProxy = peripheryFactory.attach(log.args.periphery);
    const upgradeGatekeeper = log.args.upgradeGatekeeper;

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

module.exports = {
    getDepositPubdata,
    writeDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata,
    calFee,
    deploy,
    hashBytesToBytes20
};
