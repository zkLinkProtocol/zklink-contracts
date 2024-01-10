const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, getDeployTx, createOrGetDeployLog, readDeployLogField, ChainContractDeployer} = require("./utils");
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

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();
        const deployerWallet = contractDeployer.deployerWallet;
        deployLog[logName.DEPLOY_LOG_GOVERNOR] = deployerWallet.address;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog, null, 2));

        // deploy l2 gateway
        let gatewayAddr;
        if (!(logName.DEPLOY_GATEWAY in deployLog) || force) {
            console.log('deploy l2 gateway...');
            const contract = await contractDeployer.deployProxy(contractName, allParams);
            const transaction = await getDeployTx(contract);
            gatewayAddr = await contract.getAddress();
            deployLog[logName.DEPLOY_GATEWAY] = gatewayAddr;
            deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = transaction.hash;
            deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = transaction.blockNumber;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog, null, 2));
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
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog, null, 2));
        } else {
            gatewayTargetAddr = deployLog[logName.DEPLOY_GATEWAY_TARGET];
        }
        console.log("l2 gateway target", gatewayTargetAddr);

        // verify contract
        if ((!(logName.DEPLOY_GATEWAY_TARGET_VERIFIED in deployLog) || force) && !taskArgs.skipVerify) {
            await verifyContractCode(hardhat, gatewayTargetAddr, []);
            deployLog[logName.DEPLOY_GATEWAY_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog, null, 2));
        }
    });

task("upgradeL2Gateway","Upgrade L2 gateway")
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs,hardhat)=>{
        let skipVerify = taskArgs.skipVerify;
        console.log("skipVerify", skipVerify);

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

        const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX);
        const contractAddr = deployLog[logName.DEPLOY_GATEWAY];
        if (contractAddr === undefined) {
            console.log('l2 gateway address not exist');
            return;
        }
        console.log('l2 gateway', contractAddr);
        const oldContractTargetAddr = deployLog[logName.DEPLOY_GATEWAY_TARGET];
        if (oldContractTargetAddr === undefined) {
            console.log('l2 gateway target address not exist');
            return;
        }
        console.log('l2 gateway old target', oldContractTargetAddr);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        console.log("upgrade l2 gateway...");
        const contract = await contractDeployer.upgradeProxy(l2GatewayInfo.contractName, contractAddr);
        const tx = await getDeployTx(contract);
        console.log('upgrade tx', tx.hash);
        const newContractTargetAddr = await getImplementationAddress(hardhat.ethers.provider, contractAddr);
        deployLog[logName.DEPLOY_GATEWAY_TARGET] = newContractTargetAddr;
        console.log("l2 gateway new target", newContractTargetAddr);
        fs.writeFileSync(deployLogPath,JSON.stringify(deployLog, null, 2));

        if (!skipVerify) {
            await verifyContractCode(hardhat, newContractTargetAddr, []);
            deployLog[logName.DEPLOY_GATEWAY_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath,JSON.stringify(deployLog, null, 2));
        }
    })