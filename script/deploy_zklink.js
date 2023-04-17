const fs = require('fs');
const { verifyWithErrorHandle, createOrGetDeployLog } = require('./utils');
const { Wallet: ZkSyncWallet, Provider: ZkSyncProvider } = require("zksync-web3");
const { Deployer: ZkSyncDeployer } = require("@matterlabs/hardhat-zksync-deploy");

task("deployZkLink", "Deploy zklink contracts")
    .addParam("governor", "The governor address (default is same as deployer)", undefined, types.string, true)
    .addParam("validator", "The validator address (default is same as deployer)", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address (default is same as deployer)", undefined, types.string, true)
    .addParam("blockNumber", "The block number", 0, types.int, true)
    .addParam("timestamp", "The block timestamp", 0, types.int, true)
    .addParam("genesisRoot", "The block root hash")
    .addParam("commitment", "The block commitment", "0x0000000000000000000000000000000000000000000000000000000000000000", types.string, true)
    .addParam("syncHash", "The block syncHash", "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", types.string, true)
    .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
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
        const timestamp = taskArgs.timestamp;
        const genesisRoot = taskArgs.genesisRoot;
        const commitment = taskArgs.commitment;
        const syncHash = taskArgs.syncHash;
        console.log('deployer', deployerWallet.address);
        console.log('governor', governor);
        console.log('validator', validator);
        console.log('feeAccount', feeAccount);
        console.log('blockNumber', blockNumber);
        console.log('timestamp', timestamp);
        console.log('genesisRoot', genesisRoot);
        console.log('commitment', commitment);
        console.log('syncHash', syncHash);
        console.log('force redeploy all contracts?', force);
        console.log('skip verify contracts?', skipVerify);

        const balance = await deployerWallet.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const {deployLogPath,deployLog} = createOrGetDeployLog('deploy');

        deployLog.deployer = deployerWallet.address;
        deployLog.governor = governor;
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        // verifier
        let verifierTarget;
        if (!('verifierTarget' in deployLog) || force) {
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
            verifierTarget = verifier.address;
            deployLog.verifierTarget = verifierTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            verifierTarget = deployLog.verifierTarget;
        }
        console.log('verifier target', verifierTarget);
        if ((!('verifierTargetVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify verifier target...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: verifierTarget
                });
            }, () => {
                deployLog.verifierTargetVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // periphery
        let peripheryTarget;
        if (!('peripheryTarget' in deployLog) || force) {
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
            peripheryTarget = periphery.address;
            deployLog.peripheryTarget = peripheryTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            peripheryTarget = deployLog.peripheryTarget;
        }
        console.log('periphery target', peripheryTarget);
        if ((!('peripheryTargetVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify periphery target...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: peripheryTarget
                });
            }, () => {
                deployLog.peripheryTargetVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // zkLink
        let zkLinkTarget;
        if (!('zkLinkTarget' in deployLog) || force) {
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
            zkLinkTarget = zkLink.address;
            deployLog.zkLinkTarget = zkLinkTarget;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkLinkTarget = deployLog.zkLinkTarget;
        }
        console.log('zkLink target', zkLinkTarget);
        if ((!('zkLinkTargetVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify zkLink target...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: zkLinkTarget
                });
            }, () => {
                deployLog.zkLinkTargetVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // deploy factory
        let deployFactoryAddr;
        let zkLinkProxyAddr;
        let verifierProxyAddr;
        let gatekeeperAddr;
        if (!('deployFactory' in deployLog) || force) {
            console.log('use deploy factory...');
            const deployArgs = [
                verifierTarget,
                zkLinkTarget,
                peripheryTarget,
                blockNumber,
                timestamp,
                hardhat.ethers.utils.arrayify(genesisRoot),
                hardhat.ethers.utils.arrayify(commitment),
                hardhat.ethers.utils.arrayify(syncHash),
                validator,
                governor,
                feeAccount
            ];
            let deployFactory;
            if (isZksync) {
                const deployFactoryArtifact = await zkSyncDeployer.loadArtifact('DeployFactory');
                deployFactory = await zkSyncDeployer.deploy(deployFactoryArtifact, deployArgs);
            } else {
                const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
                deployFactory = await deployFactoryFactory.connect(deployerWallet).deploy(...deployArgs);
            }
            await deployFactory.deployed();
            deployFactoryAddr = deployFactory.address;
            const deployTxReceipt = await deployFactory.deployTransaction.wait();
            const deployBlockNumber = deployTxReceipt.blockNumber;
            const tx = deployFactory.deployTransaction;
            const txr = await tx.wait();
            deployLog.deployFactory = deployFactoryAddr;
            deployLog.deployFactoryBlockHash = txr.blockHash;
            deployLog.deployTxHash = txr.transactionHash;
            deployLog.deployBlockNumber = deployBlockNumber;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            deployFactoryAddr = deployLog.deployFactory;
        }
        console.log('deployFactory', deployFactoryAddr);

        if (!('zkLinkProxy' in deployLog) || force) {
            console.log('query deploy factory filter...');
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployerWallet).attach(deployFactoryAddr);
            const deployBlockNumber = deployLog.deployBlockNumber;
            const filter = await deployFactory.filters.Addresses();
            const events = await deployFactory.queryFilter(filter, deployBlockNumber, deployBlockNumber);
            const event = events[0];
            zkLinkProxyAddr = event.args.zkLink;
            verifierProxyAddr = event.args.verifier;
            gatekeeperAddr = event.args.gatekeeper;

            deployLog.zkLinkProxy = zkLinkProxyAddr;
            deployLog.verifierProxy = verifierProxyAddr;
            deployLog.gatekeeper = gatekeeperAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            zkLinkProxyAddr = deployLog.zkLinkProxy;
            verifierProxyAddr = deployLog.verifierProxy;
            gatekeeperAddr = deployLog.gatekeeper;
        }
        console.log('zkLinkProxy', zkLinkProxyAddr);
        console.log('verifierProxy', verifierProxyAddr);
        console.log('gatekeeper', gatekeeperAddr);

        // zksync verify contract where created in contract not support now
        if (!isZksync) {
            if ((!('zkLinkProxyVerified' in deployLog) || force) && !skipVerify) {
                console.log('verify zkLink proxy...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: zkLinkProxyAddr,
                        constructorArguments:[
                            zkLinkTarget,
                            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','uint32','uint256','bytes32','bytes32','bytes32'],
                                [verifierProxyAddr, peripheryTarget, deployFactoryAddr, blockNumber, timestamp, genesisRoot, commitment, syncHash])
                        ]
                    });
                }, () => {
                    deployLog.zkLinkProxyVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
            if ((!('verifierProxyVerified' in deployLog) || force) && !skipVerify) {
                console.log('verify verifier proxy...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: verifierProxyAddr,
                        constructorArguments:[
                            verifierTarget,
                            hardhat.ethers.utils.defaultAbiCoder.encode([], []),
                        ]
                    });
                }, () => {
                    deployLog.verifierProxyVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
            if ((!('gatekeeperVerified' in deployLog) || force) && !skipVerify) {
                console.log('verify gatekeeper...');
                await verifyWithErrorHandle(async () => {
                    await hardhat.run("verify:verify", {
                        address: gatekeeperAddr,
                        constructorArguments:[
                            zkLinkProxyAddr
                        ]
                    });
                }, () => {
                    deployLog.gatekeeperVerified = true;
                })
                fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
            }
        }
});
