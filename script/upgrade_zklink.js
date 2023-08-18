const fs = require('fs');
const { verifyContractCode, getDeployLog } = require('./utils');
const logName = require('./deploy_log_name');
const { Wallet: ZkSyncWallet, Provider: ZkSyncProvider } = require("zksync-web3");
const { Deployer: ZkSyncDeployer } = require("@matterlabs/hardhat-zksync-deploy");

task("upgradeZkLink", "Upgrade zkLink")
    .addParam("upgradeVerifier", "Upgrade verifier", false, types.boolean, true)
    .addParam("upgradeZkLink", "Upgrade zkLink", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const network = hardhat.network;
        const isZksync = network.zksync !== undefined && network.zksync;
        console.log('is zksync?', isZksync);
        // use the first account of accounts in the hardhat network config as the deployer
        const deployerKey = hardhat.network.config.accounts[0];
        let deployerWallet;
        let zkSyncDeployer;
        if (isZksync) {
            const zkSyncProvider = new ZkSyncProvider(hardhat.network.config.url);
            deployerWallet = new ZkSyncWallet(deployerKey, zkSyncProvider);
            zkSyncDeployer = new ZkSyncDeployer(hardhat, deployerWallet);
        } else {
            [deployerWallet] = await hardhat.ethers.getSigners();
        }
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
        const balance = await deployerWallet.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

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
        if (upgradeStatus === 0) {
            // verifier
            if (upgradeVerifier) {
                console.log('deploy verifier target...');
                let verifier;
                if (isZksync) {
                    const verifierArtifact = await zkSyncDeployer.loadArtifact('EmptyVerifier');
                    verifier = await zkSyncDeployer.deploy(verifierArtifact);
                } else {
                    const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
                    verifier = await verifierFactory.connect(deployerWallet).deploy();
                }
                await verifier.deployed();
                deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET] = verifier.address;
                console.log('verifier target', verifier.address);
                if (!skipVerify) {
                    await verifyContractCode(hardhat, verifier.address, []);
                    deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
                }
            }

            // zkLink
            if (upgradeZkLink) {
                console.log('deploy periphery target...');
                let periphery;
                if (isZksync) {
                    const peripheryArtifact = await zkSyncDeployer.loadArtifact('ZkLinkPeriphery');
                    periphery = await zkSyncDeployer.deploy(peripheryArtifact);
                } else {
                    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
                    periphery = await peripheryFactory.connect(deployerWallet).deploy();
                }
                await periphery.deployed();
                deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET] = periphery.address;
                console.log('periphery target', periphery.address);
                if (!skipVerify) {
                    await verifyContractCode(hardhat, periphery.address, []);
                    deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET_VERIFIED] = true;
                }

                console.log('deploy zkLink target...');
                let zkLink;
                if (isZksync) {
                    const zkLinkArtifact = await zkSyncDeployer.loadArtifact('ZkLink');
                    zkLink = await zkSyncDeployer.deploy(zkLinkArtifact);
                } else {
                    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
                    zkLink = await zkLinkFactory.connect(deployerWallet).deploy();
                }
                await zkLink.deployed();
                deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET] = zkLink.address;
                console.log('zkLink target', zkLink.address);
                if (!skipVerify) {
                    await verifyContractCode(hardhat, zkLink.address, []);
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
        if (noticePeriod > 0) {
            console.log('Notice period is not zero, can not exec this task');
            return;
        }

        const upgradeTargets = [hardhat.ethers.constants.AddressZero, hardhat.ethers.constants.AddressZero];
        const upgradeParameters = ['0x','0x'];
        if (upgradeVerifier) {
            upgradeTargets[0] = deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET];
        }
        if (upgradeZkLink) {
            upgradeTargets[1] = deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET];
            upgradeParameters[1] = hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET]])
        }

        if (upgradeStatus === 0) {
            console.log('start upgrade...');
            const startUpgradeTx = await gatekeeper.connect(deployerWallet).startUpgrade(upgradeTargets);
            console.info(`upgrade start tx: ${startUpgradeTx.hash}`);
            await startUpgradeTx.wait();
            upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
            console.log('upgrade status after start: ', upgradeStatus);
        }

        if (upgradeStatus === 1) {
            console.log('start preparation...');
            const startPreparationUpgradeTx = await gatekeeper.connect(deployerWallet).startPreparation();
            console.info(`upgrade preparation tx: ${startPreparationUpgradeTx.hash}`);
            await startPreparationUpgradeTx.wait();
            upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
            console.log('upgrade status after preparation: ', upgradeStatus);
        }

        if (upgradeStatus === 2) {
            const finishUpgradeTx = await gatekeeper.connect(deployerWallet).finishUpgrade(upgradeParameters);
            console.info(`upgrade finish tx: ${finishUpgradeTx.hash}`);
            await finishUpgradeTx.wait();
            upgradeStatus = await gatekeeper.connect(deployerWallet).upgradeStatus();
            console.log('upgrade status after finish: ', upgradeStatus);
        }
        console.info('upgrade successful');
    });
