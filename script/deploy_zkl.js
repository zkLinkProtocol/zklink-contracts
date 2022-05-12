const { verifyWithErrorHandle, readDeployerKey } = require('./utils');
const { layerZero } = require('./layerzero');

task("deployZKL", "Deploy ZKL token")
    .addParam("gov", "The governance contract address", undefined, types.string, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let govAddr = taskArgs.gov;
        let skipVerify = taskArgs.skipVerify;
        if (skipVerify === undefined) {
            skipVerify = false;
        }
        console.log('deployer', deployer.address);
        console.log('gov', govAddr);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero config not exist')
            return;
        }

        const govFactory = await hardhat.ethers.getContractFactory('Governance');
        const govContract = govFactory.attach(govAddr);

        // deploy zkl
        console.log('deploy zkl...');
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = await zklFactory.connect(deployer).deploy(govAddr);
        await zklContract.deployed();
        const zklContractAddr = zklContract.address;
        console.log('zkl', zklContractAddr);

        // verify zkl
        if (!skipVerify) {
            console.log('verify zkl...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: zklContractAddr,
                    constructorArguments: [govAddr]
                });
            }, () => {
            })
        }

        // deploy lz bridge
        console.log('deploy layerzero bridge...');
        const lzBridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge', deployer);
        const lzBridgeContract = await hardhat.upgrades.deployProxy(lzBridgeFactory, [govAddr, lzInfo.address], {kind: "uups"});
        await lzBridgeContract.deployed();
        const lzBridgeAddr = lzBridgeContract.address;
        console.log('lzBridge', lzBridgeAddr);
        const lzBridgeImplAddr = await hardhat.upgrades.erc1967.getImplementationAddress(lzBridgeAddr);
        console.log('lzBridge implAddr', lzBridgeImplAddr);

        // verify lz bridge impl
        if (!skipVerify) {
            console.log('verify lz bridge impl...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: lzBridgeImplAddr,
                    constructorArguments: []
                });
            }, () => {
            })
        }

        // connect zkl and bridge
        const governor = await govContract.networkGovernor();
        if (deployer.address === governor) {
            console.log('connect zkl and bridge...');
            await govContract.connect(deployer).addBridge(lzBridgeAddr);
            await lzBridgeContract.connect(deployer).setApp(0, zklContractAddr);
            console.log('connect finish');
        }
});
