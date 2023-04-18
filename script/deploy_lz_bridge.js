const fs = require('fs');
const { verifyWithErrorHandle, createOrGetDeployLog, readDeployLogField } = require('./utils');
const logName = require('./deploy_log_name');
const {layerZero} = require("./layerzero");
const { Wallet: ZkSyncWallet, Provider: ZkSyncProvider } = require("zksync-web3");
const { Deployer: ZkSyncDeployer } = require("@matterlabs/hardhat-zksync-deploy");

task("deployLZBridge", "Deploy LayerZeroBridge")
    .addParam("governor", "The governor address (default get from zkLink deploy log)", undefined, types.string, true)
    .addParam("zklink", "The zklink address (default get from zkLink deploy log)", undefined, types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const network = hardhat.network;
        const isZksync = network.zksync !== undefined && network.zksync;
        console.log('is zksync?', isZksync);
        // use the first account of accounts in the hardhat network config as the deployer
        const deployerKey = hardhat.network.config.accounts[0];
        let deployerWallet;
        let zkSyncDeployer;
        if (isZksync) {
            const zkSyncProvider = new ZkSyncProvider(hardhat.network.config.url);
            deployerWallet = new ZkSyncWallet(deployerKey, zkSyncProvider);
            zkSyncDeployer = new ZkSyncDeployer(hardhat, deployerWallet);
        } else {
            [deployerWallet] = await hardhat.ethers.getSigners();
        }
        let governor = taskArgs.governor;
        if (governor === undefined) {
            governor = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        }
        let zklink = taskArgs.zklink;
        if (zklink === undefined) {
            zklink = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        }
        let force = taskArgs.force;
        let skipVerify = taskArgs.skipVerify;
        console.log('deployer', deployerWallet.address);
        console.log('governor', governor);
        console.log('zklink', zklink);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployerWallet.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero config not exist')
            return;
        }

        const {deployLogPath,deployLog} = createOrGetDeployLog(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX);

        deployLog[logName.DEPLOY_LOG_DEPLOYER] = deployerWallet.address;
        deployLog[logName.DEPLOY_LOG_GOVERNOR] = governor;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        // deploy lz bridge
        let args = [governor, zklink, lzInfo.address];
        let lzBridge;
        if (!(logName.DEPLOY_LOG_LZ_BRIDGE in deployLog) || force) {
            console.log('deploy layerzero bridge...');
            let lzBridgeContract;
            if (isZksync) {
                const lzBridgeArtifact = await zkSyncDeployer.loadArtifact('LayerZeroBridge');
                lzBridgeContract = await zkSyncDeployer.deploy(lzBridgeArtifact, args);
            } else {
                const lzBridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
                lzBridgeContract = await lzBridgeFactory.connect(deployerWallet).deploy(...args);
            }
            await lzBridgeContract.deployed();
            lzBridge = lzBridgeContract.address;
            deployLog[logName.DEPLOY_LOG_LZ_BRIDGE] = lzBridge;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            lzBridge = deployLog[logName.DEPLOY_LOG_LZ_BRIDGE];
        }
        console.log('lzBridge', lzBridge);
        if ((!(logName.DEPLOY_LOG_LZ_BRIDGE_VERIFIED in deployLog) || force) && !skipVerify) {
            console.log('verify lzBridge...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: lzBridge,
                    constructorArguments: args
                });
            }, () => {
                deployLog[logName.DEPLOY_LOG_LZ_BRIDGE_VERIFIED] = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});
