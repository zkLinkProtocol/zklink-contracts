const fs = require('fs');

task("deploy", "Deploy zklink")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("governor", "The governor address, default is same as deployer", undefined, types.string, true)
    .addParam("validator", "The validator address, default is same as deployer", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address, default is same as deployer", undefined, types.string, true)
    .addParam("genesisRoot", "The genesis root hash")
    .addParam("force", "Fore redeploy all contracts, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
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
        let skipVerify = taskArgs.skipVerify;
        if (skipVerify === undefined) {
            skipVerify = false;
        }
        const genesisRoot = taskArgs.genesisRoot;
        console.log('deployer', deployer.address);
        console.log('governor', governor);
        console.log('validator', validator);
        console.log('feeAccount', feeAccount);
        console.log('genesisRoot', genesisRoot);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const deployLogPath = `log/deploy_${process.env.NET}.log`;
        console.log('deploy log path', deployLogPath);
        if (!fs.existsSync('log')) {
            fs.mkdirSync('log', true);
        }

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
        if (!('governanceTargetVerified' in deployLog) && !skipVerify) {
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
        if (!('verifierTargetVerified' in deployLog) && !skipVerify) {
            console.log('verify verifier target...');
            await hardhat.run("verify:verify", {
                address: verifierTarget
            });
            deployLog.verifierTargetVerified = true;
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
        if (!('vaultTargetVerified' in deployLog) && !skipVerify) {
            console.log('verify vault target...');
            await hardhat.run("verify:verify", {
                address: vaultTarget
            });
            deployLog.vaultTargetVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLinkBlock
        let zkSyncBlockAddr;
        if (!('zkSyncBlock' in deployLog)) {
            console.log('deploy zkLinkBlock...');
            const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkLinkBlock');
            const zkSyncBlock = await zkSyncBlockFactory.connect(deployer).deploy();
            await zkSyncBlock.deployed();
            zkSyncBlockAddr = zkSyncBlock.address;
            deployLog.zkSyncBlock = zkSyncBlockAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkSyncBlockAddr = deployLog.zkSyncBlock;
        }
        console.log('zkLinkBlock', zkSyncBlockAddr);
        if (!('zkSyncBlockVerified' in deployLog) && !skipVerify) {
            console.log('verify zkLinkBlock...');
            await hardhat.run("verify:verify", {
                address: zkSyncBlockAddr
            });
            deployLog.zkSyncBlockVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLinkExit
        let zkSyncExitAddr;
        if (!('zkSyncExit' in deployLog)) {
            console.log('deploy zkLinkExit...');
            const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkLinkExit');
            const zkSyncExit = await zkSyncExitFactory.connect(deployer).deploy();
            await zkSyncExit.deployed();
            zkSyncExitAddr = zkSyncExit.address;
            deployLog.zkSyncExit = zkSyncExitAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkSyncExitAddr = deployLog.zkSyncExit;
        }
        console.log('zkLinkExit', zkSyncExitAddr);
        if (!('zkSyncExitVerified' in deployLog) && !skipVerify) {
            console.log('verify zkLinkExit...');
            await hardhat.run("verify:verify", {
                address: zkSyncExitAddr
            });
            deployLog.zkSyncExitVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLink
        let zkSyncTarget;
        if (!('zkSyncTarget' in deployLog)) {
            console.log('deploy zkLink target...');
            const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkSync = await zkSyncFactory.connect(deployer).deploy();
            await zkSync.deployed();
            zkSyncTarget = zkSync.address;
            deployLog.zkSyncTarget = zkSyncTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkSyncTarget = deployLog.zkSyncTarget;
        }
        console.log('zkLink target', zkSyncTarget);
        if (!('zkSyncTargetVerified' in deployLog) && !skipVerify) {
            console.log('verify zkLink target...');
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
                zkSyncBlockAddr,
                zkSyncExitAddr,
                govTarget,
                verifierTarget,
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
            zkSyncProxyAddr = event.args.zkLink;
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
        console.log('zkLinkProxy', zkSyncProxyAddr);
        console.log('verifierProxy', verifierProxyAddr);
        console.log('vaultProxy', vaultProxyAddr);
        console.log('gatekeeper', gatekeeperAddr);

        if (!('governanceProxyVerified' in deployLog) && !skipVerify) {
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
        if (!('zkSyncProxyVerified' in deployLog) && !skipVerify) {
            console.log('verify zkLink proxy...');
            await hardhat.run("verify:verify", {
                address: zkSyncProxyAddr,
                constructorArguments:[
                    zkSyncTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                        [governanceProxyAddr, verifierProxyAddr, vaultProxyAddr, zkSyncBlockAddr, zkSyncExitAddr, genesisRoot])
                ]
            });
            deployLog.zkSyncProxyVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if (!('verifierProxyVerified' in deployLog) && !skipVerify) {
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
        if (!('vaultProxyVerified' in deployLog) && !skipVerify) {
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
        if (!('gatekeeperVerified' in deployLog) && !skipVerify) {
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
        if (!('zklVerified' in deployLog) && !skipVerify) {
            console.log('verify zkl...');
            await hardhat.run("verify:verify", {
                address: zklContractAddr,
                constructorArguments: ["ZKLINK", "ZKL", cap, governor, zkSyncProxyAddr]
            });
            deployLog.zklVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // nft
        let nftContractAddr;
        let proxyRegistryAddress = hardhat.ethers.constants.AddressZero;
        // only eth mainnet or rinkeby has opeansea proxyRegistryAddress
        if (process.env.NET === 'ETH') {
            proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
        } else if (process.env.NET === 'RINKEBY') {
            proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
        }
        console.log('nft proxyRegistryAddress', proxyRegistryAddress);
        if (!('nft' in deployLog)) {
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
        } else {
            nftContractAddr = deployLog.nft;
        }
        console.log('nft', nftContractAddr);
        if (!('nftVerified' in deployLog) && !skipVerify) {
            console.log('verify nft...');
            await hardhat.run("verify:verify", {
                address: nftContractAddr,
                constructorArguments: [proxyRegistryAddress]
            });
            deployLog.nftVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        console.log('governance change nft...');
        if (deployer.address === governor) {
            const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
            const governanceContract = governanceFactory.attach(governanceProxyAddr);
            await governanceContract.connect(deployer).changeNft(nftContractAddr);
        } else {
            console.log('governor address is different with deployer, you should change nft manually')
        }

        // stake pool
        let poolContractAddr;
        if (!('pool' in deployLog)) {
            console.log('deploy stake pool...');
            const poolFactory = await hardhat.ethers.getContractFactory('StakePool');
            const poolContract = await poolFactory.connect(deployer).deploy(nftContractAddr, zklContractAddr, zkSyncProxyAddr, governor);
            await poolContract.deployed();
            poolContractAddr = poolContract.address;
            deployLog.pool = poolContractAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            poolContractAddr = deployLog.pool;
        }
        console.log('pool', poolContractAddr);
        if (!('poolVerified' in deployLog) && !skipVerify) {
            console.log('verify pool...');
            await hardhat.run("verify:verify", {
                address: poolContractAddr,
                constructorArguments: [nftContractAddr, zklContractAddr, zkSyncProxyAddr, governor]
            });
            deployLog.poolVerified = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});

task("upgrade", "Upgrade zkKink on testnet")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("upgradeGovernance", "Upgrade governance, default is false", undefined, types.boolean, true)
    .addParam("upgradeVerifier", "Upgrade verifier, default is false", undefined, types.boolean, true)
    .addParam("upgradeVault", "Upgrade vault, default is false", undefined, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        let deployer;
        const key = taskArgs.key;
        if (key === undefined) {
            [deployer] = await hardhat.ethers.getSigners();
        } else {
            deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        }
        let upgradeGovernance = taskArgs.upgradeGovernance === undefined ? false : taskArgs.upgradeGovernance;
        let upgradeVerifier = taskArgs.upgradeVerifier === undefined ? false : taskArgs.upgradeVerifier;
        let upgradeVault = taskArgs.upgradeVault === undefined ? false : taskArgs.upgradeVault;
        let upgradeZksync = taskArgs.upgradeZkLink === undefined ? false : taskArgs.upgradeZkLink;
        let skipVerify = taskArgs.skipVerify === undefined ? false : taskArgs.skipVerify;
        console.log('deployer', deployer.address);
        console.log('upgrade governance?', upgradeGovernance);
        console.log('upgrade verifier?', upgradeVerifier);
        console.log('upgrade vault?', upgradeVault);
        console.log('upgrade zkLink?', upgradeZksync);
        console.log('skip verify contracts?', skipVerify);
        if (!upgradeGovernance && !upgradeVerifier && !upgradeVault && !upgradeZksync) {
            console.log('no need upgrade');
            return;
        }

        // deploy log must exist
        const deployLogPath = `log/deploy_${process.env.NET}.log`;
        console.log('deploy log path', deployLogPath);
        if (!fs.existsSync(deployLogPath)) {
            console.log('deploy log not exist')
            return;
        }
        const data = fs.readFileSync(deployLogPath, 'utf8');
        let deployLog = JSON.parse(data);

        // check if upgrade at testnet
        let zkSyncProxyAddr = deployLog.zkSyncProxy;
        if (zkSyncProxyAddr === undefined) {
            console.log('ZkLink proxy address not exist');
            return;
        }
        const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkLink');
        let zkSyncProxy = await zkSyncFactory.attach(zkSyncProxyAddr);
        const noticePeriod = await zkSyncProxy.connect(deployer).getNoticePeriod();
        if (noticePeriod > 0) {
            console.log('Notice period is not zero, can not exec this task in main net');
            return;
        }

        // attach upgrade gatekeeper
        const gatekeeperAddr = deployLog.gatekeeper;
        if (gatekeeperAddr === undefined) {
            console.log('Gatekeeper address not exist');
            return;
        }
        const gatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
        const gatekeeper = await gatekeeperFactory.attach(gatekeeperAddr);

        // log deployer balance
        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const upgradeTargets = [hardhat.ethers.constants.AddressZero,
            hardhat.ethers.constants.AddressZero,
            hardhat.ethers.constants.AddressZero,
            hardhat.ethers.constants.AddressZero];
        const upgradeParameters = [[],[],[],[]];

        // governance
        if (upgradeGovernance) {
            console.log('deploy governance target...');
            const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
            const governance = await governanceFactory.connect(deployer).deploy();
            await governance.deployed();
            deployLog.governanceTarget = governance.address;
            upgradeTargets[0] = deployLog.governanceTarget;
            console.log('governance target', deployLog.governanceTarget);
            if (!skipVerify) {
                console.log('verify governance target...');
                await hardhat.run("verify:verify", {
                    address: deployLog.governanceTarget
                });
                deployLog.governanceTargetVerified = true;
            }
        }

        // verifier
        if (upgradeVerifier) {
            console.log('deploy verifier target...');
            const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
            const verifier = await verifierFactory.connect(deployer).deploy();
            await verifier.deployed();
            deployLog.verifierTarget = verifier.address;
            upgradeTargets[1] = deployLog.verifierTarget;
            console.log('verifier target', deployLog.verifierTarget);
            if (!skipVerify) {
                console.log('verify verifier target...');
                await hardhat.run("verify:verify", {
                    address: deployLog.verifierTarget
                });
                deployLog.verifierTargetVerified = true;
            }
        }

        // vault
        if (upgradeVault) {
            console.log('deploy vault target...');
            const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
            const vault = await vaultFactory.connect(deployer).deploy();
            await vault.deployed();
            deployLog.vaultTarget = vault.address;
            upgradeTargets[2] = deployLog.vaultTarget;
            console.log('vault target', deployLog.vaultTarget);
            if (!skipVerify) {
                console.log('verify vault target...');
                await hardhat.run("verify:verify", {
                    address: deployLog.vaultTarget
                });
                deployLog.vaultTargetVerified = true;
            }
        }

        // zkLink
        if (upgradeZksync) {
            console.log('deploy zkLinkBlock...');
            const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkLinkBlock');
            const zkSyncBlock = await zkSyncBlockFactory.connect(deployer).deploy();
            await zkSyncBlock.deployed();
            deployLog.zkSyncBlock = zkSyncBlock.address;
            console.log('zkLinkBlock', deployLog.zkSyncBlock);

            console.log('deploy zkLinkExit...');
            const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkLinkExit');
            const zkSyncExit = await zkSyncExitFactory.connect(deployer).deploy();
            await zkSyncExit.deployed();
            deployLog.zkSyncExit = zkSyncExit.address;
            console.log('zkLinkExit', deployLog.zkSyncExit);

            if (!skipVerify) {
                console.log('verify zkLinkBlock...');
                await hardhat.run("verify:verify", {
                    address: deployLog.zkSyncBlock
                });
                deployLog.zkSyncBlockVerified = true;

                console.log('verify zkLinkExit...');
                await hardhat.run("verify:verify", {
                    address: deployLog.zkSyncExit
                });
                deployLog.zkSyncExitVerified = true;
            }

            console.log('deploy zkLink target...');
            const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkSync = await zkSyncFactory.connect(deployer).deploy();
            await zkSync.deployed();
            deployLog.zkSyncTarget = zkSync.address;
            upgradeTargets[3] = deployLog.zkSyncTarget;
            upgradeParameters[3] = hardhat.ethers.utils.defaultAbiCoder.encode(['address','address'], [deployLog.zkSyncBlock, deployLog.zkSyncExit]);
            console.log('zkLink target', deployLog.zkSyncTarget);

            if (!skipVerify) {
                console.log('verify zkLink target...');
                await hardhat.run("verify:verify", {
                    address: deployLog.zkSyncTarget
                });
                deployLog.zkSyncTargetVerified = true;
            }
        }

        console.log('start upgrade...');
        const startUpgradeTx = await gatekeeper.connect(deployer).startUpgrade(upgradeTargets);
        console.info(`upgrade start tx: ${startUpgradeTx.hash}`);
        await startUpgradeTx.wait();

        console.log('start preparation...');
        const startPreparationUpgradeTx = await gatekeeper.connect(deployer).startPreparation();
        console.info(`upgrade preparation tx: ${startPreparationUpgradeTx.hash}`);
        await startPreparationUpgradeTx.wait();

        const finishUpgradeTx = await gatekeeper.connect(deployer).finishUpgrade(upgradeParameters);
        console.info(`upgrade finish tx: ${finishUpgradeTx.hash}`);
        await finishUpgradeTx.wait();

        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        console.info('upgrade successful');
    });

task("deploy_strategy", "Deploy strategy")
    .addParam("key", "The deployer key", undefined, types.string, true)
    .addParam("strategy", "The strategy contract name")
    .addParam("params", "The strategy deploy params")
    .setAction(async (taskArgs, hardhat) => {
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
