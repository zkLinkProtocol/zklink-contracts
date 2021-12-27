const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');
const { layerZero } = require('./layerzero');

task("deployZKL", "Deploy ZKL token")
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

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero not exist')
            return;
        }

        // deploy zkl
        let zklContractAddr;
        const cap = hardhat.ethers.utils.parseEther('1000000000');
        const isGenesisChain = process.env.NET === 'ETH' || process.env.NET === 'RINKEBY';
        console.log('deploy zkl...');
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = await zklFactory.connect(deployer).deploy("ZKLINK", "ZKL", cap, lzInfo.address, governor, isGenesisChain);
        await zklContract.deployed();
        zklContractAddr = zklContract.address;
        deployLog.zkl = zklContractAddr;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.log('zkl', zklContractAddr);

        // verify contract
        console.log('verify zkl...');
        await verifyWithErrorHandle(async () => {
            await hardhat.run("verify:verify", {
                address: zklContractAddr,
                constructorArguments: ["ZKLINK", "ZKL", cap, lzInfo.address, governor, isGenesisChain]
            });
        }, () => {
            deployLog.zklVerified = true;
        })
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
});
