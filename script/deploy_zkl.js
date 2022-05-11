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

        // layerzero must exist
        const lzInfo = layerZero[process.env.NET];
        if (lzInfo === undefined) {
            console.log('LayerZero config not exist')
            return;
        }

        // deploy bridge manager
        console.log('deploy bridge manager...');
        const bmFactory = await hardhat.ethers.getContractFactory('BridgeManager');
        const bmContract = await bmFactory.connect(deployer).deploy();
        await bmContract.deployed();
        const bmContractAddr = bmContract.address;
        console.log('bridge manager', bmContractAddr);

        // transfer ownership to governor
        await bmContract.connect(deployer).transferOwnership(governor);

        // verify bridge manager
        if (!skipVerify) {
            console.log('verify bridge manager...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: bmContractAddr,
                    constructorArguments: []
                });
            }, () => {
            })
        }

        // deploy zkl
        console.log('deploy zkl...');
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = await zklFactory.connect(deployer).deploy(bmContractAddr);
        await zklContract.deployed();
        const zklContractAddr = zklContract.address;
        console.log('zkl', zklContractAddr);

        // transfer ownership to governor
        await zklContract.connect(deployer).transferOwnership(governor);

        // verify zkl
        if (!skipVerify) {
            console.log('verify zkl...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: zklContractAddr,
                    constructorArguments: [bmContractAddr]
                });
            }, () => {
            })
        }

        // deploy lz bridge
        console.log('deploy layerzero bridge...');
        const lzBridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge', deployer);
        const lzBridgeContract = await hardhat.upgrades.deployProxy(lzBridgeFactory, [lzInfo.address], {kind: "uups"});
        await lzBridgeContract.deployed();
        const lzBridgeAddr = lzBridgeContract.address;
        console.log('lzBridge', lzBridgeAddr);
        const lzBridgeImplAddr = await hardhat.upgrades.erc1967.getImplementationAddress(lzBridgeAddr);
        console.log('lzBridge implAddr', lzBridgeImplAddr);
        // transfer ownership to governor
        await lzBridgeContract.connect(deployer).transferOwnership(governor);

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
        if (deployer.address === governor) {
            console.log('connect zkl and bridge...');
            await bmContract.connect(deployer).addBridge(lzBridgeAddr);
            await lzBridgeContract.connect(deployer).setApp(0, zklContractAddr);
            console.log('connect finish');
        }
});
