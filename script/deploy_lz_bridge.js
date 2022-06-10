const fs = require('fs');
const { verifyWithErrorHandle, createOrGetDeployLog } = require('./utils');
const {layerZero} = require("./layerzero");

task("deployLZBridge", "Deploy LayerZeroBridge")
    .addParam("governor", "The governor address (default is same as deployer)", undefined, types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const [deployer] = await hardhat.ethers.getSigners();
        let governor = taskArgs.governor;
        if (governor === undefined) {
            governor = deployer.address;
        }
        let force = taskArgs.force;
        let skipVerify = taskArgs.skipVerify;
        console.log('deployer', deployer.address);
        console.log('governor', governor);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero config not exist')
            return;
        }

        const {deployLogPath,deployLog} = createOrGetDeployLog('deploy_lz_bridge');

        // deploy lz bridge
        let lzBridgeProxy;
        if (!('lzBridge' in deployLog) || force) {
            console.log('deploy layerzero bridge...');
            const lzBridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
            const lzBridgeContract = await hardhat.upgrades.deployProxy(lzBridgeFactory, [governor, lzInfo.address], {kind: "uups"});
            await lzBridgeContract.deployed();
            lzBridgeProxy = lzBridgeContract.address;
            deployLog.lzBridgeProxy = lzBridgeProxy;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            lzBridgeProxy = deployLog.lzBridgeProxy;
        }
        console.log('lzBridgeProxy', lzBridgeProxy);
        const lzBridgeTarget = await hardhat.upgrades.erc1967.getImplementationAddress(lzBridgeProxy);
        deployLog.lzBridgeTarget = lzBridgeTarget;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.log('lzBridgeTarget', lzBridgeTarget);
        if ((!('lzBridgeTargetVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify lzBridge target...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: lzBridgeTarget,
                    constructorArguments: []
                });
            }, () => {
                deployLog.lzBridgeTargetVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});
