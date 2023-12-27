const fs = require('fs');
const { verifyContractCode, createOrGetDeployLog, ChainContractDeployer} = require('./utils');
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
            let proxy = await contractDeployer.deployContract('Proxy', [verifierTarget, verifierTargetInitializationParameters]);
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
            let proxy = await contractDeployer.deployContract('Proxy', [zkLinkTarget, zkLinkInitParams]);
            const deploymentTransaction = await proxy.deploymentTransaction();
            const transaction = await deploymentTransaction.getTransaction();
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
            const contractFactory = await hardhat.ethers.getContractFactory('Proxy');
            const contract = contractFactory.attach(verifierProxy);
            const tx = await contract.connect(deployerWallet).transferMastership(upgradeGatekeeper);
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_VERIFIER_TRAMSFER_MASTERSHIP] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        if (!(logName.DEPLOY_LOG_ZKLINK_TRAMSFER_MASTERSHIP in deployLog) || force) {
            console.log('zklink transfer mastership to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory('Proxy');
            const contract = contractFactory.attach(zkLinkProxy);
            const tx = await contract.connect(deployerWallet).transferMastership(upgradeGatekeeper);
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
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_VERIFIER_ADD_UPGRADE] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        if (!(logName.DEPLOY_LOG_ZKLINK_ADD_UPGRADE in deployLog) || force) {
            console.log('zklink add upgrade to gatekeeper...');
            const contractFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
            const contract = contractFactory.attach(upgradeGatekeeper);
            const tx = await contract.connect(deployerWallet).addUpgradeable(zkLinkProxy);
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_VERIFIER_ADD_UPGRADE] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // set validator
        if (!(logName.DEPLOY_LOG_ZKLINK_SET_VALIDATOR in deployLog) || force) {
            console.log('zklink set validator...');
            const contractFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
            const contract = contractFactory.attach(zkLinkProxy);
            const tx = await contract.connect(deployerWallet).setValidator(validator, true);
            console.log('tx hash: ', tx.hash);
            deployLog[logName.DEPLOY_LOG_ZKLINK_SET_VALIDATOR] = true;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
});
