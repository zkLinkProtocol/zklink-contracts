task("deploy", "Deploy zklink")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("governor", "The governor address, default is same as deployer", undefined, types.string, true)
    .addParam("validator", "The validator address, default is same as deployer", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address, default is same as deployer", undefined, types.string, true)
    .addParam("genesisRoot", "The genesis root hash")
    .addParam("force", "Fore redeploy all contracts, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs) => {
        const hardhat = require("hardhat");
        const fs = require('fs');

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
        let force = taskArgs.force;
        if (force === undefined) {
            force = false;
        }
        const genesisRoot = taskArgs.genesisRoot;
        console.log('deployer', deployer.address);
        console.log('governor', governor);
        console.log('validator', validator);
        console.log('feeAccount', feeAccount);
        console.log('genesisRoot', genesisRoot);
        console.log('force redeploy all contracts?', force);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const deployLogPath = `log/deploy_${process.env.NET}.log`;
        console.log('deploy log path', deployLogPath);
        let deployLog = {};
        if (!force) {
            if (fs.existsSync(deployLogPath)) {
                const data = fs.readFileSync(deployLogPath, 'utf8');
                deployLog = JSON.parse(data);
            }
        }

        // governance
        let govTarget;
        if (!('governanceTarget' in deployLog)) {
            console.log('deploy governance target...');
            const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
            const governance = await governanceFactory.connect(deployer).deploy();
            await governance.deployed();
            govTarget = governance.address;
            deployLog.governanceTarget = govTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            govTarget = deployLog.governanceTarget;
        }
        console.log('governance target', govTarget);
        if (!('governanceTargetVerified' in deployLog)) {
            console.log('verify governance target...');
            await hardhat.run("verify:verify", {
                    address: govTarget
            });
            deployLog.governanceTargetVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // verifier
        let verifierTarget;
        if (!('verifierTarget' in deployLog)) {
            console.log('deploy verifier target...');
            const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
            const verifier = await verifierFactory.connect(deployer).deploy();
            await verifier.deployed();
            verifierTarget = verifier.address;
            deployLog.verifierTarget = verifierTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            verifierTarget = deployLog.verifierTarget;
        }
        console.log('verifier target', verifierTarget);
        if (!('verifierTargetVerified' in deployLog)) {
            console.log('verify verifier target...');
            await hardhat.run("verify:verify", {
                address: verifierTarget
            });
            deployLog.verifierTargetVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkSyncBlock
        let zkSyncBlockAddr;
        if (!('zkSyncBlock' in deployLog)) {
            console.log('deploy zkSyncBlock...');
            const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlock');
            const zkSyncBlock = await zkSyncBlockFactory.connect(deployer).deploy();
            await zkSyncBlock.deployed();
            zkSyncBlockAddr = zkSyncBlock.address;
            deployLog.zkSyncBlock = zkSyncBlockAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkSyncBlockAddr = deployLog.zkSyncBlock;
        }
        console.log('zkSyncBlock', zkSyncBlockAddr);
        if (!('zkSyncBlockVerified' in deployLog)) {
            console.log('verify zkSyncBlock...');
            await hardhat.run("verify:verify", {
                address: zkSyncBlockAddr
            });
            deployLog.zkSyncBlockVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // vault
        let vaultTarget;
        if (!('vaultTarget' in deployLog)) {
            console.log('deploy vault target...');
            const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
            const vault = await vaultFactory.connect(deployer).deploy();
            await vault.deployed();
            vaultTarget = vault.address;
            deployLog.vaultTarget = vaultTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            vaultTarget = deployLog.vaultTarget;
        }
        console.log('vault target', vaultTarget);
        if (!('vaultTargetVerified' in deployLog)) {
            console.log('verify vault target...');
            await hardhat.run("verify:verify", {
                address: vaultTarget
            });
            deployLog.vaultTargetVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkSync
        let zkSyncTarget;
        if (!('zkSyncTarget' in deployLog)) {
            console.log('deploy zkSync target...');
            const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkSync');
            const zkSync = await zkSyncFactory.connect(deployer).deploy();
            await zkSync.deployed();
            zkSyncTarget = zkSync.address;
            deployLog.zkSyncTarget = zkSyncTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkSyncTarget = deployLog.zkSyncTarget;
        }
        console.log('zkSync target', zkSyncTarget);
        if (!('zkSyncTargetVerified' in deployLog)) {
            console.log('verify zkSync target...');
            await hardhat.run("verify:verify", {
                address: zkSyncTarget
            });
            deployLog.zkSyncTargetVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // deploy factory
        let deployFactoryAddr;
        let governanceProxyAddr;
        let zkSyncProxyAddr;
        let verifierProxyAddr;
        let vaultProxyAddr;
        let gatekeeperAddr;
        if (!('deployFactory' in deployLog)) {
            console.log('use deploy factory...');
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployer).deploy(
                govTarget,
                verifierTarget,
                zkSyncBlockAddr,
                vaultTarget,
                zkSyncTarget,
                hardhat.ethers.utils.arrayify(genesisRoot),
                validator,
                governor,
                feeAccount
            );
            await deployFactory.deployed();
            deployFactoryAddr = deployFactory.address;
            const tx = deployFactory.deployTransaction;
            const txr = await tx.wait();
            deployLog.deployFactory = deployFactoryAddr;
            deployLog.deployFactoryBlockHash = txr.blockHash;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            deployFactoryAddr = deployLog.deployFactory;
        }
        console.log('deployFactory', deployFactoryAddr);

        if (!('governanceProxy' in deployLog)) {
            console.log('query deploy factory filter...')
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployer).attach(deployFactoryAddr);
            const deployFactoryBlockHash = deployLog.deployFactoryBlockHash;
            const filter = await deployFactory.filters.Addresses();
            const events = await deployFactory.queryFilter(filter, deployFactoryBlockHash);
            const event = events[0];
            governanceProxyAddr = event.args.governance;
            zkSyncProxyAddr = event.args.zksync;
            verifierProxyAddr = event.args.verifier;
            vaultProxyAddr = event.args.vault;
            gatekeeperAddr = event.args.gatekeeper;

            deployLog.governanceProxy = governanceProxyAddr;
            deployLog.zkSyncProxy = zkSyncProxyAddr;
            deployLog.verifierProxy = verifierProxyAddr;
            deployLog.vaultProxy = vaultProxyAddr;
            deployLog.gatekeeper = gatekeeperAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            governanceProxyAddr = deployLog.governanceProxy;
            zkSyncProxyAddr = deployLog.zkSyncProxy;
            verifierProxyAddr = deployLog.verifierProxy;
            vaultProxyAddr = deployLog.vaultProxy;
            gatekeeperAddr = deployLog.gatekeeper;
        }
        console.log('governanceProxy', governanceProxyAddr);
        console.log('zkSyncProxy', zkSyncProxyAddr);
        console.log('verifierProxy', verifierProxyAddr);
        console.log('vaultProxy', vaultProxyAddr);
        console.log('gatekeeper', gatekeeperAddr);

        if (!('governanceProxyVerified' in deployLog)) {
            console.log('verify governance proxy...');
            await hardhat.run("verify:verify", {
                address: governanceProxyAddr,
                constructorArguments: [
                    govTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [deployFactoryAddr]),
                ]
            });
            deployLog.governanceProxyVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if (!('zkSyncProxyVerified' in deployLog)) {
            console.log('verify zkSync proxy...');
            await hardhat.run("verify:verify", {
                address: zkSyncProxyAddr,
                constructorArguments:[
                    zkSyncTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','bytes32'],
                        [governanceProxyAddr, verifierProxyAddr, zkSyncBlockAddr, vaultProxyAddr, genesisRoot])
                ]
            });
            deployLog.zkSyncProxyVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if (!('verifierProxyVerified' in deployLog)) {
            console.log('verify verifier proxy...');
            await hardhat.run("verify:verify", {
                address: verifierProxyAddr,
                constructorArguments:[
                    verifierTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode([], []),
                ]
            });
            deployLog.verifierProxyVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if (!('vaultProxyVerified' in deployLog)) {
            console.log('verify vault proxy...');
            await hardhat.run("verify:verify", {
                address: vaultProxyAddr,
                constructorArguments:[
                    vaultTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governanceProxyAddr])
                ]
            });
            deployLog.vaultProxyVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if (!('gatekeeperVerified' in deployLog)) {
            console.log('verify gatekeeper...');
            await hardhat.run("verify:verify", {
                address: gatekeeperAddr,
                constructorArguments:[
                    zkSyncProxyAddr
                ]
            });
            deployLog.gatekeeperVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkl
        let zklContractAddr;
        const cap = hardhat.ethers.utils.parseEther('1000000000');
        if (!('zkl' in deployLog)) {
            console.log('deploy zkl...');
            const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
            const zklContract = await zklFactory.connect(deployer).deploy("ZKLINK", "ZKL", cap, governor, zkSyncProxyAddr);
            await zklContract.deployed();
            zklContractAddr = zklContract.address;
            deployLog.zkl = zklContractAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zklContractAddr = deployLog.zkl;
        }
        console.log('zkl', zklContractAddr);
        if (!('zklVerified' in deployLog)) {
            console.log('verify zkl...');
            await hardhat.run("verify:verify", {
                address: zklContractAddr,
                constructorArguments: ["ZKLINK", "ZKL", cap, governor, zkSyncProxyAddr]
            });
            deployLog.zklVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
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
