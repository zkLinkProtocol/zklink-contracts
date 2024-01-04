const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog, readDeployLogField} = require("./utils");
const logName = require("./deploy_log_name");
const {zkLinkConfig} = require("./zklink_config");

task("deployL2Gateway", "Deploy L2 Gateway")
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

        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }

        const l2GatewayInfo = chainInfo.l2Gateway;
        if (l2GatewayInfo === undefined) {
            console.log('l2 gateway config not exist');
            return;
        }

        const { contractName, initializeParams } = l2GatewayInfo;
        const allParams = [zklink].concat(initializeParams);
        const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX);

        const [deployerWallet] = await hardhat.ethers.getSigners();
        deployLog[logName.DEPLOY_LOG_GOVERNOR] = deployerWallet.address;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        // deploy l2 gateway
        let gatewayAddr;
        if (!(logName.DEPLOY_GATEWAY in deployLog) || force) {
            console.log('deploy l2 gateway...');
            const contractFactory = await hardhat.ethers.getContractFactory(contractName);
            const contract = await hardhat.upgrades.deployProxy(contractFactory, allParams, {kind: "uups"});
            await contract.waitForDeployment();
            const transaction = await contract.deploymentTransaction().getTransaction();
            gatewayAddr = await contract.getAddress();
            deployLog[logName.DEPLOY_GATEWAY] = gatewayAddr;
            deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = transaction.hash;
            deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = transaction.blockNumber;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            gatewayAddr = deployLog[logName.DEPLOY_GATEWAY];
        }
        console.log('l2 gateway', gatewayAddr);

        let gatewayTargetAddr;
        if (!(logName.DEPLOY_GATEWAY_TARGET in deployLog) || force) {
            console.log('get l2 gateway target...');
            gatewayTargetAddr = await getImplementationAddress(
                hardhat.ethers.provider,
                gatewayAddr
            );
            deployLog[logName.DEPLOY_GATEWAY_TARGET] = gatewayTargetAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            gatewayTargetAddr = deployLog[logName.DEPLOY_GATEWAY_TARGET];
        }
        console.log("l2 gateway target", gatewayTargetAddr);

        // verify contract
        if ((!(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) || force) && !taskArgs.skipVerify) {
            await verifyContractCode(hardhat, gatewayTargetAddr, []);
            deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
    });
