const fs = require('fs');
const { verifyContractCode, createOrGetDeployLog, readDeployLogField, ChainContractDeployer} = require('./utils');
const logName = require('./deploy_log_name');
const {zkLinkConfig} = require("./zklink_config");

task("deployLZBridge", "Deploy LayerZeroBridge")
    .addParam("zklink", "The zklink address (default get from zkLink deploy log)", undefined, types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        let zklink = taskArgs.zklink;
        if (zklink === undefined) {
            zklink = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        }
        let force = taskArgs.force;
        let skipVerify = taskArgs.skipVerify;
        console.log('zklink', zklink);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        // layerzero must exist
        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }

        const lzInfo = chainInfo.layerZero;
        if (lzInfo === undefined) {
            console.log('layerzero config not exist');
            return;
        }

        const {deployLogPath,deployLog} = createOrGetDeployLog(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX);

        deployLog[logName.DEPLOY_LOG_GOVERNOR] = contractDeployer.deployerWallet.address;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        // deploy lz bridge
        let args = [zklink, lzInfo.address];
        let lzBridge;
        if (!(logName.DEPLOY_LOG_LZ_BRIDGE in deployLog) || force) {
            console.log('deploy layerzero bridge...');
            let lzBridgeContract = await contractDeployer.deployContract('LayerZeroBridge', args);
            lzBridge = await lzBridgeContract.getAddress();
            deployLog[logName.DEPLOY_LOG_LZ_BRIDGE] = lzBridge;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            lzBridge = deployLog[logName.DEPLOY_LOG_LZ_BRIDGE];
        }
        console.log('lzBridge', lzBridge);
        if ((!(logName.DEPLOY_LOG_LZ_BRIDGE_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, lzBridge, args);
            deployLog[logName.DEPLOY_LOG_LZ_BRIDGE_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});
