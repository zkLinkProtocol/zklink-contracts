const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');

task("deployPool", "Deploy pool")
    .addParam("governor", "The governor address, default is same as deployer", undefined, types.string, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let governor = taskArgs.governor;
        if (governor === undefined) {
            governor = deployer.address;
        }
        let skipVerify = taskArgs.skipVerify;
        if (skipVerify === undefined) {
            skipVerify = false;
        }
        console.log('deployer', deployer.address);
        console.log('governor', governor);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // deploy log must exist
        const deployLogPath = `log/deploy_${process.env.NET}.log`;
        console.log('deploy log path', deployLogPath);
        if (!fs.existsSync(deployLogPath)) {
            console.log('deploy log not exist')
            return;
        }
        const data = fs.readFileSync(deployLogPath, 'utf8');
        let deployLog = JSON.parse(data);

        // zkLink proxy must be deployed
        const zkSyncProxyAddr = deployLog.zkSyncProxy;
        if (zkSyncProxyAddr === undefined) {
            console.log('ZkLink proxy contract not exist')
            return;
        }

        // nft must be deployed
        const nftContractAddr = deployLog.nft;
        if (nftContractAddr === undefined) {
            console.log('NFT contract not exist')
            return;
        }

        // zkl must be deployed
        const zklContractAddr = deployLog.zkl;
        if (zklContractAddr === undefined) {
            console.log('ZKL contract not exist')
            return;
        }

        // stake pool
        let poolContractAddr;
        console.log('deploy stake pool...');
        const poolFactory = await hardhat.ethers.getContractFactory('StakePool');
        const poolContract = await poolFactory.connect(deployer).deploy(nftContractAddr, zklContractAddr, zkSyncProxyAddr, governor);
        await poolContract.deployed();
        poolContractAddr = poolContract.address;
        deployLog.pool = poolContractAddr;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.log('pool', poolContractAddr);
        console.log('verify pool...');
        await verifyWithErrorHandle(async () => {
            await hardhat.run("verify:verify", {
                address: poolContractAddr,
                constructorArguments: [nftContractAddr, zklContractAddr, zkSyncProxyAddr, governor]
            });
        }, () => {
            deployLog.poolVerified = true;
        })
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
});
