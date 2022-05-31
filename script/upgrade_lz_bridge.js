const fs = require('fs');
const { verifyWithErrorHandle, getDeployLog } = require('./utils');
const {layerZero} = require("./layerzero");

task("upgradeLZBridge", "Upgrade LayerZeroBridge on testnet")
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const [deployer] = await hardhat.ethers.getSigners();
        let skipVerify = taskArgs.skipVerify;
        if (skipVerify === undefined) {
            skipVerify = false;
        }
        console.log('deployer', deployer.address);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero config not exist')
            return;
        }

        const {deployLogPath,deployLog} = getDeployLog('deploy_lz_bridge');

        let lzBridgeProxy = deployLog.lzBridgeProxy;
        if (lzBridgeProxy === undefined) {
            console.log('LayerZeroBridge proxy address not exist');
            return;
        }
        console.log('lzBridgeProxy', lzBridgeProxy);

        const lzBridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const lzBridgeContract = await hardhat.upgrades.upgradeProxy(lzBridgeProxy, lzBridgeFactory);
        await lzBridgeContract.deployed();

        const lzBridgeTarget = await hardhat.upgrades.erc1967.getImplementationAddress(lzBridgeProxy);
        deployLog.lzBridgeTarget = lzBridgeTarget;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.log('lzBridgeTarget', lzBridgeTarget);
        if (!skipVerify) {
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
