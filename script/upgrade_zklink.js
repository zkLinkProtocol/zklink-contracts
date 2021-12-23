const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');

task("upgradeZkLink", "Upgrade zkKink on testnet")
    .addParam("upgradeGovernance", "Upgrade governance, default is false", undefined, types.boolean, true)
    .addParam("upgradeVerifier", "Upgrade verifier, default is false", undefined, types.boolean, true)
    .addParam("upgradeVault", "Upgrade vault, default is false", undefined, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
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
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.governanceTarget
                    });
                }, () => {
                    deployLog.governanceTargetVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.verifierTarget
                    });
                }, () => {
                    deployLog.verifierTargetVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.vaultTarget
                    });
                }, () => {
                    deployLog.vaultTargetVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.zkSyncBlock
                    });
                }, () => {
                    deployLog.zkSyncBlockVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

                console.log('verify zkLinkExit...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.zkSyncExit
                    });
                }, () => {
                    deployLog.zkSyncExitVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.zkSyncTarget
                    });
                }, () => {
                    deployLog.zkSyncTargetVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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
