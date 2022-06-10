const fs = require('fs');
const { verifyWithErrorHandle,getDeployLog } = require('./utils');

task("upgradeZkLink", "Upgrade zkLink on testnet")
    .addParam("upgradeVerifier", "Upgrade verifier", false, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const [deployer] = await hardhat.ethers.getSigners();
        let upgradeVerifier = taskArgs.upgradeVerifier;
        let upgradeZkLink = taskArgs.upgradeZkLink;
        let skipVerify = taskArgs.skipVerify;
        console.log('deployer', deployer.address);
        console.log('upgrade verifier?', upgradeVerifier);
        console.log('upgrade zkLink?', upgradeZkLink);
        console.log('skip verify contracts?', skipVerify);
        if (!upgradeVerifier && !upgradeZkLink) {
            console.log('no need upgrade');
            return;
        }

        // deploy log must exist
        const {deployLogPath,deployLog} = getDeployLog('deploy');

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
            hardhat.ethers.constants.AddressZero];
        const upgradeParameters = ['0x','0x'];

        // verifier
        if (upgradeVerifier) {
            console.log('deploy verifier target...');
            const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
            const verifier = await verifierFactory.connect(deployer).deploy();
            await verifier.deployed();
            deployLog.verifierTarget = verifier.address;
            upgradeTargets[0] = deployLog.verifierTarget;
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

        // zkLink
        if (upgradeZkLink) {
            console.log('deploy periphery target...');
            const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
            const periphery = await peripheryFactory.connect(deployer).deploy();
            await periphery.deployed();
            deployLog.peripheryTarget = periphery.address;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
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

            console.log('deploy zkLink target...');
            const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkLink = await zkLinkFactory.connect(deployer).deploy();
            await zkLink.deployed();
            deployLog.zkLinkTarget = zkLink.address;
            upgradeTargets[1] = deployLog.zkLinkTarget;
            upgradeParameters[1] = hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [deployLog.peripheryTarget])
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
