const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');

task("upgradeZkLink", "Upgrade zkLink on testnet")
    .addParam("upgradeGovernance", "Upgrade governance, default is false", undefined, types.boolean, true)
    .addParam("upgradeVerifier", "Upgrade verifier, default is false", undefined, types.boolean, true)
    .addParam("upgradePeriphery", "Upgrade periphery, default is false", undefined, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let upgradeGovernance = taskArgs.upgradeGovernance === undefined ? false : taskArgs.upgradeGovernance;
        let upgradeVerifier = taskArgs.upgradeVerifier === undefined ? false : taskArgs.upgradeVerifier;
        let upgradePeriphery = taskArgs.upgradePeriphery === undefined ? false : taskArgs.upgradePeriphery;
        let upgradeZkLink = taskArgs.upgradeZkLink === undefined ? false : taskArgs.upgradeZkLink;
        let skipVerify = taskArgs.skipVerify === undefined ? false : taskArgs.skipVerify;
        console.log('deployer', deployer.address);
        console.log('upgrade governance?', upgradeGovernance);
        console.log('upgrade verifier?', upgradeVerifier);
        console.log('upgrade periphery?', upgradePeriphery);
        console.log('upgrade zkLink?', upgradeZkLink);
        console.log('skip verify contracts?', skipVerify);
        if (!upgradeGovernance && !upgradeVerifier && !upgradePeriphery && !upgradeZkLink) {
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
        let zkLinkProxyAddr = deployLog.zkLinkProxy;
        if (zkLinkProxyAddr === undefined) {
            console.log('ZkLink proxy address not exist');
            return;
        }
        const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
        let zkLinkProxy = await zkLinkFactory.attach(zkLinkProxyAddr);
        const noticePeriod = await zkLinkProxy.connect(deployer).getNoticePeriod();
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

        // periphery
        if (upgradePeriphery) {
            console.log('deploy periphery target...');
            const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
            const periphery = await peripheryFactory.connect(deployer).deploy();
            await periphery.deployed();
            deployLog.peripheryTarget = periphery.address;
            upgradeTargets[2] = deployLog.peripheryTarget;
            console.log('periphery target', deployLog.peripheryTarget);
            if (!skipVerify) {
                console.log('verify periphery target...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.peripheryTarget
                    });
                }, () => {
                    deployLog.peripheryTargetVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
        }

        // zkLink
        if (upgradeZkLink) {
            console.log('deploy zkLink target...');
            const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkLink = await zkLinkFactory.connect(deployer).deploy();
            await zkLink.deployed();
            deployLog.zkLinkTarget = zkLink.address;
            upgradeTargets[3] = deployLog.zkLinkTarget;
            console.log('zkLink target', deployLog.zkLinkTarget);

            if (!skipVerify) {
                console.log('verify zkLink target...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: deployLog.zkLinkTarget
                    });
                }, () => {
                    deployLog.zkLinkTargetVerified = true;
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
