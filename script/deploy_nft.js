const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');

task("deployNFT", "Deploy nft")
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

        // governance proxy must be deployed
        const governanceProxyAddr = deployLog.governanceProxy;
        if (governanceProxyAddr === undefined) {
            console.log('Governance proxy contract not exist')
            return;
        }

        // deploy nft
        let nftContractAddr;
        let proxyRegistryAddress = hardhat.ethers.constants.AddressZero;
        // only eth mainnet or rinkeby has opeansea proxyRegistryAddress
        if (process.env.NET === 'ETH') {
            proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
        } else if (process.env.NET === 'RINKEBY') {
            proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
        }
        console.log('nft proxyRegistryAddress', proxyRegistryAddress);
        console.log('deploy nft...');
        const nftFactory = await hardhat.ethers.getContractFactory('ZkLinkNFT');
        const nftContract = await nftFactory.connect(deployer).deploy(proxyRegistryAddress);
        await nftContract.deployed();
        nftContractAddr = nftContract.address;
        deployLog.nft = nftContractAddr;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        // set ZkLink Proxy as the owner of nft
        console.log('transfer nft ownership to zkLinkProxy...');
        await nftContract.connect(deployer).transferOwnership(zkSyncProxyAddr);
        console.log('nft', nftContractAddr);
        console.log('verify nft...');
        await verifyWithErrorHandle(async () => {
            await hardhat.run("verify:verify", {
                address: nftContractAddr,
                constructorArguments: [proxyRegistryAddress]
            });
        }, () => {
            deployLog.nftVerified = true;
        })
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.log('governance change nft...');
        if (deployer.address === governor) {
            const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
            const governanceContract = governanceFactory.attach(governanceProxyAddr);
            await governanceContract.connect(deployer).changeNft(nftContractAddr);
        } else {
            console.log('governor address is different with deployer, you should change nft manually')
        }
});
