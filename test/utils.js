const hardhat = require("hardhat");
const ethers = hardhat.ethers;

function getDepositPubdata({ chainId, accountId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(subAccountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function writeDepositPubdata({ chainId, subAccountId, tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'), // OpType.Deposit
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify('0x00000000'), // ignore accountId
        ethers.utils.arrayify(subAccountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function getWithdrawPubdata({ chainId, accountId, subAccountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFeeRate }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x03'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(subAccountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(fee),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(nonce),
        ethers.utils.arrayify(isFastWithdraw),
        ethers.utils.arrayify(fastWithdrawFeeRate)
    ]);
}

function getFullExitPubdata({ chainId, accountId, subAccountId, owner, tokenId, amount}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x05'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(subAccountId),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount)
    ]);
}

function getForcedExitPubdata({ chainId, initiatorAccountId, targetAccountId, targetSubAccountId, tokenId, amount, fee, target }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x07'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(initiatorAccountId),
        ethers.utils.arrayify(targetAccountId),
        ethers.utils.arrayify(targetSubAccountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(fee),
        ethers.utils.arrayify(target)
    ]);
}

function getChangePubkeyPubdata({ chainId, accountId, pubKeyHash, owner, nonce}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x06'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(pubKeyHash),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(nonce)
    ]);
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
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
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

    const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
    const token = await erc20Factory.deploy(10000);
    const tokenId = 2;
    await governanceProxy.connect(governor).addToken(tokenId, token.address);

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
            tokenId: tokenId,
            contract: token,
        }
    }
}

module.exports = {
    getDepositPubdata,
    writeDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata,
    calFee,
    deploy
};
