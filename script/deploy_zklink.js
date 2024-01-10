const fs = require('fs');
const { verifyContractCode, createOrGetDeployLog, ChainContractDeployer, getDeployTx, getDeployLog} = require('./utils');
const logName = require('./deploy_log_name');

task("deployZkLink", "Deploy zklink contracts")
    .addParam("validator", "The validator address (default is same as deployer)", undefined, types.string, true)
    .addParam("blockNumber", "The block number", 0, types.int, true)
    .addParam("genesisRoot", "The block root hash", "0x0000000000000000000000000000000000000000000000000000000000000000", types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const abiCoder = new hardhat.ethers.AbiCoder()
        const isMasterChain = hardhat.config.isMasterChain;
        if (typeof isMasterChain === 'undefined') {
            console.log('master chain not config');
            return;
        }
        console.log('is master chain?', isMasterChain);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();
        const deployerWallet = contractDeployer.deployerWallet;

        let validator = taskArgs.validator;
        if (validator === undefined) {
            validator = deployerWallet.address;
        }
        const force = taskArgs.force;
        const skipVerify = taskArgs.skipVerify;
        const blockNumber = taskArgs.blockNumber;
        const genesisRoot = taskArgs.genesisRoot;
        console.log('validator', validator);
        console.log('blockNumber', blockNumber);
        console.log('genesisRoot', genesisRoot);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const {deployLogPath,deployLog} = createOrGetDeployLog(logName.DEPLOY_ZKLINK_LOG_PREFIX);

        deployLog[logName.DEPLOY_LOG_DEPLOYER] = deployerWallet.address;
        deployLog[logName.DEPLOY_LOG_GOVERNOR] = deployerWallet.address;
        deployLog[logName.DEPLOY_LOG_VALIDATOR] = validator;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        const proxyContractName = contractDeployer.getProxyContractName();
        console.log('use proxy contract name: ', proxyContractName);

        // verifier
        let verifierTarget;
        if (!(logName.DEPLOY_LOG_VERIFIER_TARGET in deployLog) || force) {
            console.log('deploy verifier target...');
            let verifier;
            if (!isMasterChain) {
                verifier = await contractDeployer.deployContract('EmptyVerifier', []);
            } else {
                verifier = await contractDeployer.deployContract('Verifier', []);
            }
            verifierTarget = await verifier.getAddress();
            deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET] = verifierTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            verifierTarget = deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET];
        }
        console.log('verifier target', verifierTarget);
        if ((!(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, verifierTarget, []);
            deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // verifier proxy
        let verifierProxy;
        let verifierTargetInitializationParameters = "0x";
        if (!(logName.DEPLOY_LOG_VERIFIER_PROXY in deployLog) || force) {
            console.log('deploy verifier proxy...');
            let proxy = await contractDeployer.deployContract(proxyContractName, [verifierTarget, verifierTargetInitializationParameters]);
            verifierProxy = await proxy.getAddress();
            deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY] = verifierProxy;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            verifierProxy = deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY];
        }
        console.log('verifier proxy', verifierProxy);
        if ((!(logName.DEPLOY_LOG_VERIFIER_PROXY_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, verifierProxy, [verifierTarget, verifierTargetInitializationParameters]);
            deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // periphery
        let peripheryTarget;
        if (!(logName.DEPLOY_LOG_PERIPHERY_TARGET in deployLog) || force) {
            console.log('deploy periphery target...');
            let periphery = await contractDeployer.deployContract('ZkLinkPeriphery', []);
            peripheryTarget = await periphery.getAddress();
            deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET] = peripheryTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            peripheryTarget = deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET];
        }
        console.log('periphery target', peripheryTarget);
        if ((!(logName.DEPLOY_LOG_PERIPHERY_TARGET_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, peripheryTarget, []);
            deployLog[logName.DEPLOY_LOG_PERIPHERY_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLink
        let zkLinkTarget;
        if (!(logName.DEPLOY_LOG_ZKLINK_TARGET in deployLog) || force) {
            console.log('deploy zkLink target...');
            let zkLink = await contractDeployer.deployContract('ZkLink', [peripheryTarget]);
            zkLinkTarget = await zkLink.getAddress();
            deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET] = zkLinkTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkLinkTarget = deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET];
        }
        console.log('zkLink target', zkLinkTarget);
        if ((!(logName.DEPLOY_LOG_ZKLINK_TARGET_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, zkLinkTarget, [peripheryTarget]);
            deployLog[logName.DEPLOY_LOG_ZKLINK_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLink proxy
        let zkLinkProxy;
        let zkLinkDeployTxHash;
        let zkLinkDeployBlockNumber;
        let zkLinkInitParams = isMasterChain ?
            abiCoder.encode(['address','address', "bytes32"], [verifierProxy, deployerWallet.address, genesisRoot]) :
            abiCoder.encode(['address','address', "uint32"], [verifierProxy, deployerWallet.address, blockNumber]);
        console.log("zklink init params: ", zkLinkInitParams);
        if (!(logName.DEPLOY_LOG_ZKLINK_PROXY in deployLog) || force) {
            console.log('deploy zklink proxy...');
            let proxy = await contractDeployer.deployContract(proxyContractName, [zkLinkTarget, zkLinkInitParams]);
            const transaction = await getDeployTx(proxy);
            zkLinkProxy = await proxy.getAddress();
            zkLinkDeployTxHash = transaction.hash;
            zkLinkDeployBlockNumber = transaction.blockNumber;
            deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY] = zkLinkProxy;
            deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = zkLinkDeployTxHash;
            deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = zkLinkDeployBlockNumber;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkLinkProxy = deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY];
            zkLinkDeployTxHash = deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH];
            zkLinkDeployBlockNumber = deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER];
        }
        console.log('zklink proxy', zkLinkProxy);
        console.log('deploy zklink tx hash', zkLinkDeployTxHash);
        console.log('deploy zklink block number', zkLinkDeployBlockNumber);
        if ((!(logName.DEPLOY_LOG_ZKLINK_PROXY_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, zkLinkProxy, [zkLinkTarget, zkLinkInitParams]);
            deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // upgradeGatekeeper
        let upgradeGatekeeper;
        if (!(logName.DEPLOY_LOG_GATEKEEPER in deployLog) || force) {
            console.log('deploy upgrade gatekeeper...');
            let contract = await contractDeployer.deployContract('UpgradeGatekeeper', [zkLinkProxy]);
            upgradeGatekeeper = await contract.getAddress();
            deployLog[logName.DEPLOY_LOG_GATEKEEPER] = upgradeGatekeeper;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            upgradeGatekeeper = deployLog[logName.DEPLOY_LOG_GATEKEEPER];
        }
        console.log('upgrade gatekeeper', upgradeGatekeeper);
        if ((!(logName.DEPLOY_LOG_GATEKEEPER_VERIFIED in deployLog) || force) && !skipVerify) {
            await verifyContractCode(hardhat, upgradeGatekeeper, [zkLinkProxy]);
            deployLog[logName.DEPLOY_LOG_GATEKEEPER_VERIFIED] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // transfer mastership to gatekeeper
        if (!(logName.DEPLOY_LOG_VERIFIER_TRAMSFER_MASTERSHIP in deployLog) || force) {
            console.log('verifier transfer mastership to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory(proxyContractName);
            const contract = contractFactory.attach(verifierProxy);
            const tx = await contract.connect(deployerWallet).transferMastership(upgradeGatekeeper);
            await tx.wait();
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_VERIFIER_TRAMSFER_MASTERSHIP] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        if (!(logName.DEPLOY_LOG_ZKLINK_TRAMSFER_MASTERSHIP in deployLog) || force) {
            console.log('zklink transfer mastership to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory(proxyContractName);
            const contract = contractFactory.attach(zkLinkProxy);
            const tx = await contract.connect(deployerWallet).transferMastership(upgradeGatekeeper);
            await tx.wait();
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_ZKLINK_TRAMSFER_MASTERSHIP] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // addUpgradeable
        if (!(logName.DEPLOY_LOG_VERIFIER_ADD_UPGRADE in deployLog) || force) {
            console.log('verifier add upgrade to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
            const contract = contractFactory.attach(upgradeGatekeeper);
            const tx = await contract.connect(deployerWallet).addUpgradeable(verifierProxy);
            await tx.wait();
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_VERIFIER_ADD_UPGRADE] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        if (!(logName.DEPLOY_LOG_ZKLINK_ADD_UPGRADE in deployLog) || force) {
            console.log('zklink add upgrade to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
            const contract = contractFactory.attach(upgradeGatekeeper);
            const tx = await contract.connect(deployerWallet).addUpgradeable(zkLinkProxy);
            await tx.wait();
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_ZKLINK_ADD_UPGRADE] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // set validator
        if (!(logName.DEPLOY_LOG_ZKLINK_SET_VALIDATOR in deployLog) || force) {
            console.log('zklink set validator...');
            const contractFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
            const contract = contractFactory.attach(zkLinkProxy);
            const tx = await contract.connect(deployerWallet).setValidator(validator, true);
            await tx.wait();
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_ZKLINK_SET_VALIDATOR] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});

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
