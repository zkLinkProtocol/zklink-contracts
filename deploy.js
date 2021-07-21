task("deploy", "Deploy zklink")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("governor", "The governor address", undefined, types.string, true)
    .addParam("validator", "The validator address", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address", undefined, types.string, true)
    .addParam("genesisRoot", "The genesis root hash")
    .setAction(async (taskArgs) => {
        const hardhat = require("hardhat");
        let deployer;
        const key = taskArgs.key;
        if (key === undefined) {
            [deployer] = await hardhat.ethers.getSigners();
        } else {
            deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        }
        let governor = taskArgs.governor;
        if (governor === undefined) {
            governor = deployer.address;
        }
        let validator = taskArgs.validator;
        if (validator === undefined) {
            validator = deployer.address;
        }
        let feeAccount = taskArgs.feeAccount;
        if (feeAccount === undefined) {
            feeAccount = deployer.address;
        }
        const genesisRoot = taskArgs.genesisRoot;
        console.log('deployer', deployer.address);
        console.log('governor', governor);
        console.log('validator', validator);
        console.log('feeAccount', feeAccount);
        console.log('genesisRoot', genesisRoot);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // governance
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        const governance = await governanceFactory.connect(deployer).deploy();
        await governance.deployed();
        const govTarget = governance.address;
        console.log('governance target', govTarget);
        await hardhat.run("verify:verify", {
            address: govTarget
        });
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.connect(deployer).deploy();
        await verifier.deployed();
        const verifierTarget = verifier.address;
        console.log('verifier target', verifierTarget);
        await hardhat.run("verify:verify", {
            address: verifierTarget
        });
        // zkSyncBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlock');
        const zkSyncBlock = await zkSyncBlockFactory.connect(deployer).deploy();
        await zkSyncBlock.deployed();
        const zkSyncBlockAddr = zkSyncBlock.address;
        console.log('zkSyncBlock', zkSyncBlockAddr);
        await hardhat.run("verify:verify", {
            address: zkSyncBlockAddr
        });
        // pairManager
        const pairManagerFactory = await hardhat.ethers.getContractFactory('UniswapV2Factory');
        const pairManager = await pairManagerFactory.connect(deployer).deploy();
        await pairManager.deployed();
        const pairManagerTarget = pairManager.address;
        console.log('pairManager target', pairManagerTarget);
        await hardhat.run("verify:verify", {
            address: pairManagerTarget
        });
        // vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        const vault = await vaultFactory.connect(deployer).deploy();
        await vault.deployed();
        const vaultTarget = vault.address;
        console.log('vault target', vaultTarget);
        await hardhat.run("verify:verify", {
            address: vaultTarget
        });
        // zkSync
        const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkSync');
        const zkSync = await zkSyncFactory.connect(deployer).deploy();
        await zkSync.deployed();
        const zkSyncTarget = zkSync.address;
        console.log('zkSync target', zkSyncTarget);
        await hardhat.run("verify:verify", {
            address: zkSyncTarget
        });

        // deploy
        const deployFactory = await hardhat.ethers.getContractFactory('DeployFactory');
        const deploy = await deployFactory.connect(deployer).deploy(
            govTarget,
            verifierTarget,
            zkSyncBlockAddr,
            pairManagerTarget,
            vaultTarget,
            zkSyncTarget,
            hardhat.ethers.utils.arrayify(genesisRoot),
            validator,
            governor,
            feeAccount
        );
        await deploy.deployed();
        console.log('deploy factory', deploy.address);

        const txr = deploy.deployTransaction;
        const filter = await deploy.filters.Addresses();
        const events = await deploy.queryFilter(filter, txr.blockHash);
        const event = events[0];
        const governanceProxyAddr = event.args.governance;
        const zksyncProxyAddr = event.args.zksync;
        const verifierProxyAddr = event.args.verifier;
        const pairManagerProxyAddr = event.args.pairManager;
        const vaultProxyAddr = event.args.vault;
        const gatekeeperAddr = event.args.gatekeeper;
        console.log('governanceProxyAddr', governanceProxyAddr);
        console.log('zksyncProxyAddr', zksyncProxyAddr);
        console.log('verifierProxyAddr', verifierProxyAddr);
        console.log('pairManagerProxyAddr', pairManagerProxyAddr);
        console.log('vaultProxyAddr', vaultProxyAddr);
        console.log('gatekeeperAddr', gatekeeperAddr);

        await hardhat.run("verify:verify", {
            address: governanceProxyAddr,
            constructorArguments: [
                govTarget,
                hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [deploy.address]),
            ]
        });
        await hardhat.run("verify:verify", {
            address: zksyncProxyAddr,
            constructorArguments:[
                zkSyncTarget,
                hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                    [governanceProxyAddr, verifierProxyAddr, zkSyncBlockAddr, pairManagerProxyAddr, vaultProxyAddr, genesisRoot])
            ]
        });
        await hardhat.run("verify:verify", {
            address: verifierProxyAddr,
            constructorArguments:[
                verifierTarget,
                hardhat.ethers.utils.defaultAbiCoder.encode([], []),
            ]
        });
        await hardhat.run("verify:verify", {
            address: pairManagerProxyAddr,
            constructorArguments:[
                pairManagerTarget,
                hardhat.ethers.utils.defaultAbiCoder.encode([], []),
            ]
        });
        await hardhat.run("verify:verify", {
            address: vaultProxyAddr,
            constructorArguments:[
                vaultTarget,
                hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governanceProxyAddr])
            ]
        });
        await hardhat.run("verify:verify", {
            address: gatekeeperAddr,
            constructorArguments:[
                zksyncProxyAddr
            ]
        });
});

task("deploy_strategy", "Deploy strategy")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("strategy", "The strategy contract name")
    .addParam("params", "The strategy deploy params")
    .setAction(async (taskArgs) => {
        const hardhat = require("hardhat");
        let deployer;
        const key = taskArgs.key;
        if (key === undefined) {
            [deployer] = await hardhat.ethers.getSigners();
        } else {
            deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        }
        const strategy = taskArgs.strategy;
        const params = taskArgs.params;
        console.log('deployer', deployer.address);
        console.log('strategy', strategy);
        console.log('params', params);
        const args = params.split(' ');

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const strategyFactory = await hardhat.ethers.getContractFactory(strategy);
        const strategyContract = await strategyFactory.connect(deployer).deploy(...args);
        await strategyContract.deployed();
        console.log('strategy address', strategyContract.address);
        await hardhat.run("verify:verify", {
            address: strategyContract.address,
            constructorArguments: args
        });
    });
