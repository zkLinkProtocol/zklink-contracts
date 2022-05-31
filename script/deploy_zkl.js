const fs = require("fs");
const { verifyWithErrorHandle, createOrGetDeployLog, readDeployContract} = require('./utils');

task("deployZKL", "Deploy ZKL token")
    .addParam("zkLink", "The zkLink contract address, default get from deploy log", undefined, types.string, true)
    .addParam("force", "Fore redeploy all contracts, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const [deployer] = await hardhat.ethers.getSigners();
        let force = taskArgs.force;
        if (force === undefined) {
            force = false;
        }
        let skipVerify = taskArgs.skipVerify;
        if (skipVerify === undefined) {
            skipVerify = false;
        }
        let govAddr = taskArgs.zkLink;
        if (govAddr === undefined) {
            govAddr = readDeployContract('deploy', 'zkLinkProxy');
        }
        console.log('deployer', deployer.address);
        console.log('zkLink', govAddr);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const {deployLogPath,deployLog} = createOrGetDeployLog('deploy_zkl');

        // deploy zkl
        let zklContractAddr;
        if (!('zkl' in deployLog) || force) {
            console.log('deploy zkl...');
            const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
            const zklContract = await zklFactory.connect(deployer).deploy(govAddr);
            await zklContract.deployed();
            zklContractAddr = zklContract.address;
            deployLog.zkl = zklContractAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zklContractAddr = deployLog.zkl;
        }
        console.log('zkl', zklContractAddr);

        // verify zkl
        if ((!('zklVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify zkl...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: zklContractAddr,
                    constructorArguments: [govAddr]
                });
            }, () => {
                deployLog.zklVerified = true;
            });
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});
