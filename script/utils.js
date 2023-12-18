const fs = require("fs");
const path = require("path");

async function verifyContractCode(hardhat, address, constructorArguments) {
    // contract code may be not exist after tx send to chain
    // try every one minutes if verify failed
    console.log('verify %s code...', address);
    while (true) {
        try {
            await hardhat.run("verify:verify", {
                address: address,
                constructorArguments: constructorArguments
            });
            console.log('contract code verified success');
            return;
        } catch (e) {
            if (e.message.includes('Already Verified')
                || e.message.includes('Contract source code already verified')
                || e.message.includes('Smart-contract already verified')
            ) {
                console.log('contract code already verified');
                return;
            } else {
                console.warn('verify code failed: %s', e.message);
            }
        }
        await new Promise(r => setTimeout(r, 60000));
    }
}

function createOrGetDeployLog(name) {
    const deployLogPath = getDeployLogPath(name, process.env.NET);
    console.log('deploy log path', deployLogPath);
    if (!fs.existsSync('log')) {
        fs.mkdirSync('log', true);
    }

    let deployLog = {};
    if (fs.existsSync(deployLogPath)) {
        const data = fs.readFileSync(deployLogPath, 'utf8');
        deployLog = JSON.parse(data);
    }
    return {deployLogPath, deployLog};
}

function getDeployLog(name, env = process.env.NET) {
    const deployLogPath = getDeployLogPath(name, env);
    console.log('deploy log path', deployLogPath);
    if (!fs.existsSync(deployLogPath)) {
        throw 'deploy log not exist';
    }
    const data = fs.readFileSync(deployLogPath, 'utf8');
    let deployLog = JSON.parse(data);
    return {deployLogPath, deployLog};
}

function readDeployContract(logName, contractName, env = process.env.NET) {
    return readDeployLogField(logName, contractName, env);
}

function readDeployLogField(logName, fieldName, env = process.env.NET) {
    const deployLogPath = getDeployLogPath(logName, env);
    if (!fs.existsSync(deployLogPath)) {
        throw 'deploy log not exist';
    }
    const data = fs.readFileSync(deployLogPath, 'utf8');
    const deployLog = JSON.parse(data);
    const fieldValue = deployLog[fieldName];
    if (fieldValue === undefined) {
        throw fieldName + ' not exit';
    }
    return fieldValue;
}

function getDeployLogPath(logName, env = process.env.NET) {
    const zkLinkRoot = path.resolve(__dirname, "..");
    return `${zkLinkRoot}/log/${logName}_${env}.log`;
}

class ChainContractDeployer {

    constructor(hardhat) {
        this.hardhat = hardhat;
    }

    async init() {
        console.log('init contract deployer...');
        const network = this.hardhat.network;
        // a flag to identify if chain is zksync
        this.zksync = network.zksync !== undefined && network.zksync;
        console.log('deploy on zksync?', this.zksync);
        // use the first account of accounts in the hardhat network config as the deployer
        const deployerKey = network.config.accounts[0];
        if (this.zksync) {
            const { Wallet: ZkSyncWallet, Provider: ZkSyncProvider } = require("../zksync/node_modules/zksync-ethers");
            const { Deployer: ZkSyncDeployer } = require("../zksync/node_modules/@matterlabs/hardhat-zksync-deploy");

            this.zkSyncProvider = new ZkSyncProvider(network.config.url);
            this.deployerWallet = new ZkSyncWallet(deployerKey, this.zkSyncProvider);
            this.zkSyncDeployer = new ZkSyncDeployer(this.hardhat, this.deployerWallet);
        } else {
            [this.deployerWallet] = await this.hardhat.ethers.getSigners();
        }
        console.log('deployer', this.deployerWallet.address);
        const balance = await  this.hardhat.ethers.provider.getBalance(this.deployerWallet.address);
        console.log('deployer balance', this.hardhat.ethers.formatEther(balance));
    }

    async deployContract(contractName, deployArgs) {
        let contract;
        if (this.zksync) {
            const artifact = await this.zkSyncDeployer.loadArtifact(contractName);
            contract = await this.zkSyncDeployer.deploy(artifact, deployArgs);
        } else {
            const factory = await this.hardhat.ethers.getContractFactory(contractName);
            contract = await factory.connect(this.deployerWallet).deploy(...deployArgs);
        }
        await contract.waitForDeployment();
        return contract;
    }
}

module.exports = {
    verifyContractCode,
    createOrGetDeployLog,
    getDeployLog,
    readDeployContract,
    readDeployLogField,
    ChainContractDeployer
};
