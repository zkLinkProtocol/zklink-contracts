const fs = require('fs');
const { verifyContractCode, getDeployLog, ChainContractDeployer} = require('./utils');
const logName = require('./deploy_log_name');

task("upgradeZkLink", "Upgrade zkLink")
    .addParam("upgradeVerifier", "Upgrade verifier", false, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const isMasterChain = hardhat.config.isMasterChain;
        if (typeof isMasterChain === 'undefined') {
            console.log('master chain not config');
            return;
        }
        console.log('is master chain?', isMasterChain);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();
        const deployerWallet = contractDeployer.deployerWallet;

        let upgradeVerifier = taskArgs.upgradeVerifier;
        let upgradeZkLink = taskArgs.upgradeZkLink;
        let skipVerify = taskArgs.skipVerify;
        console.log('deployer', deployerWallet.address);
        console.log('upgrade verifier?', upgradeVerifier);
        console.log('upgrade zkLink?', upgradeZkLink);
        console.log('skip verify contracts?', skipVerify);
        if (!upgradeVerifier && !upgradeZkLink) {
            console.log('no need upgrade');
            return;
        }

        // deploy log must exist
        const {deployLogPath,deployLog} = getDeployLog(logName.DEPLOY_ZKLINK_LOG_PREFIX);

        let zkLinkProxyAddr = deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY];
        if (zkLinkProxyAddr === undefined) {
            console.log('ZkLink proxy address not exist');
            return;
        }

        // log deployer balance
        const balance = await hardhat.ethers.provider.getBalance(deployerWallet.address);
        console.log('deployer balance', hardhat.ethers.formatEther(balance));

        // attach upgrade gatekeeper
        const gatekeeperAddr = deployLog[logName.DEPLOY_LOG_GATEKEEPER];
        if (gatekeeperAddr === undefined) {
            console.log('Gatekeeper address not exist');
            return;
        }
        const gatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
        const gatekeeper = await gatekeeperFactory.attach(gatekeeperAddr);
        let upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
        console.log('upgrade status: ', upgradeStatus);

        // if upgrade status is Idle, then start deploy new targets
        if (upgradeStatus === 0n) {
            // verifier
            if (upgradeVerifier) {
                if (isMasterChain) {
                    console.log('deploy verifier target...');
                    const verifier = await contractDeployer.deployContract('Verifier', []);
                    const verifierTargetAddr = await verifier.getAddress();
                    deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET] = verifierTargetAddr;
                    console.log('verifier target', verifierTargetAddr);
                    if (!skipVerify) {
                        await verifyContractCode(hardhat, verifierTargetAddr, []);
                        deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
                    }
                } else {
                    console.log('no need to upgrade verifier in slaver chain');
                }
            }

            // zkLink
            if (upgradeZkLink) {
                console.log('deploy periphery target...');
                let periphery = await contractDeployer.deployContract('ZkLinkPeriphery', []);
                const peripheryTargetAddr = await periphery.getAddress();
                deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET] = peripheryTargetAddr;
                console.log('periphery target', peripheryTargetAddr);
                if (!skipVerify) {
                    await verifyContractCode(hardhat, peripheryTargetAddr, []);
                    deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET_VERIFIED] = true;
                }

                console.log('deploy zkLink target...');
                let zkLink = await contractDeployer.deployContract('ZkLink', [peripheryTargetAddr]);
                const zkLinkTargetAddr = await zkLink.getAddress();
                deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET] = zkLinkTargetAddr;
                console.log('zkLink target', zkLinkTargetAddr);
                if (!skipVerify) {
                    await verifyContractCode(hardhat, zkLinkTargetAddr, [peripheryTargetAddr]);
                    deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET_VERIFIED] = true;
                }
            }
            console.log('write new targets to log');
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // check if upgrade at testnet
        const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
        let zkLinkProxy = await zkLinkFactory.attach(zkLinkProxyAddr);
        const noticePeriod = await zkLinkProxy.connect(deployerWallet).getNoticePeriod();
        if (noticePeriod > 0n) {
            console.log('Notice period is not zero, can not exec this task');
            return;
        }

        const upgradeTargets = [hardhat.ethers.ZeroAddress, hardhat.ethers.ZeroAddress];
        if (upgradeVerifier) {
            upgradeTargets[0] = deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET];
        }
        if (upgradeZkLink) {
            upgradeTargets[1] = deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET];
        }

        if (upgradeStatus === 0n) {
            console.log('start upgrade...');
            const startUpgradeTx = await gatekeeper.connect(deployerWallet).startUpgrade(upgradeTargets);
            await startUpgradeTx.wait();
            console.info(`upgrade start tx: ${startUpgradeTx.hash}`);
            upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
            console.log('upgrade status after start: ', upgradeStatus);
        }

        if (upgradeStatus === 1n) {
            const finishUpgradeTx = await gatekeeper.connect(deployerWallet).finishUpgrade();
            await finishUpgradeTx.wait();
            console.info(`upgrade finish tx: ${finishUpgradeTx.hash}`);
            upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
            console.log('upgrade status after finish: ', upgradeStatus);
        }
        console.info('upgrade successful');
    });
