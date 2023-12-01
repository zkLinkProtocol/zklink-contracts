const fs = require('fs');
const { verifyContractCode, createOrGetDeployLog, ChainContractDeployer} = require('./utils');
const logName = require('./deploy_log_name');

task("deployZkLink", "Deploy zklink contracts")
    .addParam("governor", "The governor address (default is same as deployer)", undefined, types.string, true)
    .addParam("validator", "The validator address (default is same as deployer)", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address (default is same as deployer)", undefined, types.string, true)
    .addParam("blockNumber", "The block number", 0, types.int, true)
    .addParam("genesisRoot", "The block root hash", "0x0000000000000000000000000000000000000000000000000000000000000000", types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
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

        let governor = taskArgs.governor;
        if (governor === undefined) {
            governor = deployerWallet.address;
        }
        let validator = taskArgs.validator;
        if (validator === undefined) {
            validator = deployerWallet.address;
        }
        let feeAccount = taskArgs.feeAccount;
        if (feeAccount === undefined) {
            feeAccount = deployerWallet.address;
        }
        const force = taskArgs.force;
        const skipVerify = taskArgs.skipVerify;
        const blockNumber = taskArgs.blockNumber;
        const genesisRoot = taskArgs.genesisRoot;
        console.log('governor', governor);
        console.log('validator', validator);
        console.log('feeAccount', feeAccount);
        console.log('blockNumber', blockNumber);
        console.log('genesisRoot', genesisRoot);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const {deployLogPath,deployLog} = createOrGetDeployLog(logName.DEPLOY_ZKLINK_LOG_PREFIX);

        deployLog[logName.DEPLOY_LOG_DEPLOYER] = deployerWallet.address;
        deployLog[logName.DEPLOY_LOG_GOVERNOR] = governor;
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
            verifierTarget = verifier.address;
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

        // periphery
        let peripheryTarget;
        if (!(logName.DEPLOY_LOG_PERIPHERY_TARGET in deployLog) || force) {
            console.log('deploy periphery target...');
            let periphery = await contractDeployer.deployContract('ZkLinkPeriphery', []);
            peripheryTarget = periphery.address;
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
            zkLinkTarget = zkLink.address;
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

        // deploy factory
        let deployFactoryAddr;
        let zkLinkProxyAddr;
        let verifierProxyAddr;
        let gatekeeperAddr;
        const zkLinkInitParams = isMasterChain ?
            hardhat.ethers.utils.defaultAbiCoder.encode(["bytes32"], [genesisRoot]) :
            hardhat.ethers.utils.defaultAbiCoder.encode(["uint32"], [blockNumber]);
        if (!(logName.DEPLOY_LOG_DEPLOY_FACTORY in deployLog) || force) {
            console.log('use deploy factory...');
            const deployArgs = [
                verifierTarget,
                zkLinkTarget,
                zkLinkInitParams,
                validator,
                governor,
                feeAccount
            ];
            let deployFactory = await contractDeployer.deployContract('DeployFactory', deployArgs);
            deployFactoryAddr = deployFactory.address;
            const deployTxReceipt = await deployFactory.deployTransaction.wait();
            const deployBlockNumber = deployTxReceipt.blockNumber;
            const tx = deployFactory.deployTransaction;
            const txr = await tx.wait();
            deployLog[logName.DEPLOY_LOG_DEPLOY_FACTORY] = deployFactoryAddr;
            deployLog[logName.DEPLOY_LOG_DEPLOY_FACTORY_BLOCK_HASH] = txr.blockHash;
            deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = txr.transactionHash;
            deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = deployBlockNumber;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            deployFactoryAddr = deployLog[logName.DEPLOY_LOG_DEPLOY_FACTORY];
        }
        console.log('deployFactory', deployFactoryAddr);

        if (!(logName.DEPLOY_LOG_ZKLINK_PROXY in deployLog) || force) {
            console.log('query deploy factory filter...');
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployerWallet).attach(deployFactoryAddr);
            const deployBlockNumber = deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER];
            const filter = await deployFactory.filters.Addresses();
            const events = await deployFactory.queryFilter(filter, deployBlockNumber, deployBlockNumber);
            const event = events[0];
            zkLinkProxyAddr = event.args.zkLink;
            verifierProxyAddr = event.args.verifier;
            gatekeeperAddr = event.args.gatekeeper;

            deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY] = zkLinkProxyAddr;
            deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY] = verifierProxyAddr;
            deployLog[logName.DEPLOY_LOG_GATEKEEPER] = gatekeeperAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkLinkProxyAddr = deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY];
            verifierProxyAddr = deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY];
            gatekeeperAddr = deployLog[logName.DEPLOY_LOG_GATEKEEPER];
        }
        console.log('zkLinkProxy', zkLinkProxyAddr);
        console.log('verifierProxy', verifierProxyAddr);
        console.log('gatekeeper', gatekeeperAddr);

        // zksync verify contract where created in contract not support now
        if (!contractDeployer.zksync) {
            if ((!(logName.DEPLOY_LOG_ZKLINK_PROXY_VERIFIED in deployLog) || force) && !skipVerify) {
                await verifyContractCode(hardhat, zkLinkProxyAddr, [
                    zkLinkTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','bytes'],
                        [verifierProxyAddr, deployFactoryAddr, zkLinkInitParams])
                ]);
                deployLog[logName.DEPLOY_LOG_ZKLINK_PROXY_VERIFIED] = true;
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
            if ((!(logName.DEPLOY_LOG_VERIFIER_PROXY_VERIFIED in deployLog) || force) && !skipVerify) {
                await verifyContractCode(hardhat, verifierProxyAddr, [
                    verifierTarget,
                    hardhat.ethers.utils.defaultAbiCoder.encode([], []),
                ]);
                deployLog[logName.DEPLOY_LOG_VERIFIER_PROXY_VERIFIED] = true;
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
            if ((!(logName.DEPLOY_LOG_GATEKEEPER_VERIFIED in deployLog) || force) && !skipVerify) {
                await verifyContractCode(hardhat, gatekeeperAddr, [
                    zkLinkProxyAddr
                ]);
                deployLog[logName.DEPLOY_LOG_GATEKEEPER_VERIFIED] = true;
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
        }
});
