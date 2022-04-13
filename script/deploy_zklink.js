const fs = require('fs');
const { verifyWithErrorHandle, readDeployerKey } = require('./utils');

task("deployZkLink", "Deploy zklink contracts")
    .addParam("governor", "The governor address, default is same as deployer", undefined, types.string, true)
    .addParam("validator", "The validator address, default is same as deployer", undefined, types.string, true)
    .addParam("feeAccount", "The feeAccount address, default is same as deployer", undefined, types.string, true)
    .addParam("genesisRoot", "The genesis root hash")
    .addParam("force", "Fore redeploy all contracts, default is false", undefined, types.boolean, true)
    .addParam("skipVerify", "Skip verify, default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
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
        if (fs.existsSync(deployLogPath)) {
            const data = fs.readFileSync(deployLogPath, 'utf8');
            deployLog = JSON.parse(data);
        }

        // governance
        let govTarget;
        if (!('governanceTarget' in deployLog) || force) {
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
        if ((!('governanceTargetVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify governance target...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: govTarget
                });
            }, () => {
                deployLog.governanceTargetVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }

        // verifier
        let verifierTarget;
        if (!('verifierTarget' in deployLog) || force) {
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
            const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
            const periphery = await peripheryFactory.connect(deployer).deploy();
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
            const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkLink = await zkLinkFactory.connect(deployer).deploy();
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
        let governanceProxyAddr;
        let zkLinkProxyAddr;
        let verifierProxyAddr;
        let peripheryProxyAddr;
        let gatekeeperAddr;
        if (!('deployFactory' in deployLog) || force) {
            console.log('use deploy factory...');
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployer).deploy(
                govTarget,
                verifierTarget,
                peripheryTarget,
                zkLinkTarget,
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
            deployLog.deployTxHash = txr.transactionHash;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            deployFactoryAddr = deployLog.deployFactory;
        }
        console.log('deployFactory', deployFactoryAddr);

        if (!('governanceProxy' in deployLog) || force) {
            console.log('query deploy factory filter...')
            const deployFactoryFactory = await hardhat.ethers.getContractFactory('DeployFactory');
            const deployFactory = await deployFactoryFactory.connect(deployer).attach(deployFactoryAddr);
            const deployFactoryBlockHash = deployLog.deployFactoryBlockHash;
            const filter = await deployFactory.filters.Addresses();
            const events = await deployFactory.queryFilter(filter, deployFactoryBlockHash);
            const event = events[0];
            governanceProxyAddr = event.args.governance;
            zkLinkProxyAddr = event.args.zkLink;
            verifierProxyAddr = event.args.verifier;
            peripheryProxyAddr = event.args.periphery;
            gatekeeperAddr = event.args.gatekeeper;

            deployLog.governanceProxy = governanceProxyAddr;
            deployLog.zkLinkProxy = zkLinkProxyAddr;
            deployLog.verifierProxy = verifierProxyAddr;
            deployLog.peripheryProxyAddr = peripheryProxyAddr;
            deployLog.gatekeeper = gatekeeperAddr;
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        } else {
            governanceProxyAddr = deployLog.governanceProxy;
            zkLinkProxyAddr = deployLog.zkLinkProxy;
            verifierProxyAddr = deployLog.verifierProxy;
            peripheryProxyAddr = deployLog.peripheryProxyAddr;
            gatekeeperAddr = deployLog.gatekeeper;
        }
        console.log('governanceProxy', governanceProxyAddr);
        console.log('zkLinkProxy', zkLinkProxyAddr);
        console.log('verifierProxy', verifierProxyAddr);
        console.log('peripheryProxy', peripheryProxyAddr);
        console.log('gatekeeper', gatekeeperAddr);

        if ((!('governanceProxyVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify governance proxy...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: governanceProxyAddr,
                    constructorArguments: [
                        govTarget,
                        hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [deployFactoryAddr]),
                    ]
                });
            }, () => {
                deployLog.governanceProxyVerified = true;
            })
            fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
        }
        if ((!('zkLinkProxyVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify zkLink proxy...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: zkLinkProxyAddr,
                    constructorArguments:[
                        zkLinkTarget,
                        hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','bytes32'],
                            [governanceProxyAddr, verifierProxyAddr, peripheryProxyAddr, genesisRoot])
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
        if ((!('peripheryProxyVerified' in deployLog) || force) && !skipVerify) {
            console.log('verify periphery proxy...');
            await verifyWithErrorHandle(async () => {
                await hardhat.run("verify:verify", {
                    address: peripheryProxyAddr,
                    constructorArguments:[
                        peripheryTarget,
                        hardhat.ethers.utils.defaultAbiCoder.encode([], []),
                    ]
                });
            }, () => {
                deployLog.peripheryProxyVerified = true;
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
});
