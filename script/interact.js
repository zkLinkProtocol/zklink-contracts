const { readDeployContract, readDeployLogField } = require('./utils');
const logName = require('./deploy_log_name');
const { zkLinkConfig, getChainConfig, getEthChainConfig } = require('./zklink_config');
const {extendAddress} = require("./op_utils");

async function governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr, tokenDecimals) {
    console.log('Adding new ERC20 token to network: ', tokenAddr);
    const governanceFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addToken(tokenId, tokenAddr, tokenDecimals);
    const receipt = await tx.wait();
    console.log('tx hash: ', tx.hash);
    if (receipt.status) {
        console.log('tx success');
    } else {
        throw new Error(`failed add token to the zkLink`);
    }
}

task("addToken", "Adds a new token with a given address for testnet")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("tokenId", "The token id")
    .addParam("tokenAddress", "The token address")
    .addParam("tokenDecimals", "The token decimals", 18, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        const [governor] = await hardhat.ethers.getSigners();
        let governanceAddr = taskArgs.zkLink;
        if (governanceAddr === undefined) {
            governanceAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        }
        const tokenId = taskArgs.tokenId;
        const tokenAddr = taskArgs.tokenAddress;
        const tokenDecimals = taskArgs.tokenDecimals;
        console.log('governor', governor.address);
        console.log('zkLink', governanceAddr);
        console.log('token id', tokenId);
        console.log('token address', tokenAddr);
        console.log('token decimals', tokenDecimals);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        await governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr, tokenDecimals);
    });

task("depositERC20", "Deposit erc20 token to zkLink on testnet")
    .addParam("zklink", "The zklink proxy address")
    .addParam("token", "The token address")
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs, hardhat) => {
            const [sender] = await hardhat.ethers.getSigners();
            const zkLinkProxy = taskArgs.zklink;
            const token = taskArgs.token;
            const decimals = taskArgs.decimals;
            const amount = taskArgs.amount;
            console.log('zklink address', zkLinkProxy);
            console.log('token address', token);
            console.log('decimals', decimals);
            console.log('amount', amount);

            const balance = await hardhat.ethers.provider.getBalance(sender.address);
            console.log('sender eth balance', hardhat.ethers.formatEther(balance));
            const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
            const erc20 = erc20Factory.attach(token);
            const tokenBalance = await erc20.connect(sender).balanceOf(sender.address);
            console.log('sender token balance', hardhat.ethers.formatEther(tokenBalance, decimals));

            const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkLink = zkLinkFactory.attach(zkLinkProxy);
            const amountInWei = hardhat.ethers.parseUnits(amount, decimals);
            const allowance = await erc20.connect(sender).allowance(sender.address, zkLink);
            if (allowance === 0n) {
                    console.log('add unlimited allowance');
                    const tx = await erc20.connect(sender).approve(zkLink, hardhat.ethers.MaxUint256);
                    await tx.wait();
                    console.log('approve tx hash', tx.hash);
            }
            const tx = await zkLink.connect(sender).depositERC20(token, amountInWei, extendAddress(sender.address), 0, false);
            await tx.wait();
            console.log('tx', tx.hash);
    });

task("configLayerZeroBridge", "Set chain destination address for layerzero bridge")
    .setAction(async (taskArgs, hardhat) => {
        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }
        console.log('is mainnet?', chainInfo.mainnet);
        const CHAIN_ID = hardhat.config.solpp.defs.CHAIN_ID;
        const MASTER_CHAIN_ID = hardhat.config.solpp.defs.MASTER_CHAIN_ID;
        const ALL_CHAINS = hardhat.config.solpp.defs.ALL_CHAINS;
        if (CHAIN_ID !== chainInfo.zkLinkChainId) {
            console.log(`CHAIN_ID: ${CHAIN_ID} != zkLinkChainId: ${chainInfo.zkLinkChainId}`);
            return;
        }

        const lzInfo = chainInfo.layerZero;
        if (lzInfo === undefined) {
            console.log('layerzero not support current net');
            return;
        }

        const bridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE);
        const governorAddress = readDeployLogField(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        if (CHAIN_ID === MASTER_CHAIN_ID) {
            console.log("config layerzero bridge for master chain");
            for (let [slaverNet, slaverConfig] of Object.entries(zkLinkConfig)) {
                const chainIndex = 1 << slaverConfig.zkLinkChainId - 1;
                if ((chainIndex & ALL_CHAINS) === chainIndex && slaverConfig.zkLinkChainId !== CHAIN_ID && chainInfo.mainnet === slaverConfig.mainnet) {
                    console.log("slaver chain:", slaverNet);
                    const slaverLayerZeroConfig = slaverConfig.layerZero;
                    if (slaverLayerZeroConfig === undefined) {
                        console.log(`layerzero not support slaver chain`);
                        continue;
                    }
                    let dstBridgeAddr = await bridgeContract.connect(governor).destinations(slaverLayerZeroConfig.chainId);
                    if (dstBridgeAddr !== "0x") {
                        console.log("slaver chain was configured", dstBridgeAddr);
                        continue;
                    }
                    dstBridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE, slaverNet);

                    console.log("set destination...");
                    const tx1 = await bridgeContract.connect(governor).setDestination(slaverConfig.zkLinkChainId, slaverLayerZeroConfig.chainId, dstBridgeAddr);
                    await tx1.wait();
                    console.log('set destination tx hash:', tx1.hash);
                }
            }
        } else {
            console.log("config layerzero bridge for slaver chain");
            let masterConfig = getChainConfig(zkLinkConfig, MASTER_CHAIN_ID, chainInfo.mainnet);
            if (masterConfig.chainConfig === undefined) {
                console.log("master chain layerzero config not found");
                return;
            }
            console.log("master chain:", masterConfig.net);
            const masterLayerZeroConfig = masterConfig.chainConfig.layerZero;
            if (masterLayerZeroConfig === undefined) {
                console.log(`layerzero not support master chain`);
                return;
            }
            let dstBridgeAddr = await bridgeContract.connect(governor).destinations(masterLayerZeroConfig.chainId);
            if (dstBridgeAddr !== "0x") {
                console.log("master chain was configured", dstBridgeAddr);
                return;
            }
            dstBridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE, masterConfig.net);

            console.log("set destination...");
            const tx1 = await bridgeContract.connect(governor).setDestination(masterConfig.chainConfig.zkLinkChainId, masterLayerZeroConfig.chainId, dstBridgeAddr);
            await tx1.wait();
            console.log('set destination tx hash:', tx1.hash);
        }
    });

task("updateLayerZeroBridge", "Update chain destination address for layerzero bridge")
    .addParam("targetNet", "The target net name")
    .setAction(async (taskArgs, hardhat) => {
        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }

        const lzInfo = chainInfo.layerZero;
        if (lzInfo === undefined) {
            console.log('layerzero not support current net');
            return;
        }

        const targetNet = taskArgs.targetNet;
        console.log('target net', targetNet);
        let targetConfig = getChainConfig(zkLinkConfig, targetNet, chainInfo.mainnet);
        if (targetConfig.chainConfig === undefined) {
            console.log("target chain config not found");
            return;
        }
        const targetLayerZeroConfig = targetConfig.layerZero;
        if (targetLayerZeroConfig === undefined) {
            console.log(`layerzero not support target chain`);
            return;
        }

        const bridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE);
        const governorAddress = readDeployLogField(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        const dstBridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE, targetNet);
        console.log("set destination...", dstBridgeAddr);
        const tx1 = await bridgeContract.connect(governor).setDestination(targetConfig.zkLinkChainId, targetLayerZeroConfig.chainId, dstBridgeAddr);
        await tx1.wait();
        console.log('set destination tx hash:', tx1.hash);
    });

task("addBridge", "Add bridge to zkLink")
    .addParam("bridge", "The bridge address (default get from deploy log)", undefined, types.string, true)
    .setAction(async (taskArgs, hardhat) => {
        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }
        console.log('is mainnet?', chainInfo.mainnet);
        const CHAIN_ID = hardhat.config.solpp.defs.CHAIN_ID;
        const MASTER_CHAIN_ID = hardhat.config.solpp.defs.MASTER_CHAIN_ID;
        const ALL_CHAINS = hardhat.config.solpp.defs.ALL_CHAINS;
        if (CHAIN_ID !== chainInfo.zkLinkChainId) {
            console.log(`CHAIN_ID: ${CHAIN_ID} != zkLinkChainId: ${chainInfo.zkLinkChainId}`);
            return;
        }

        let bridgeAddr = taskArgs.bridge;
        if (bridgeAddr === undefined) {
            bridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE);
        }

        const governorAddress = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);

        const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);
        console.log('zkLink', zkLinkProxyAddr);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const peripheryContract = peripheryFactory.attach(zkLinkProxyAddr);

        if (CHAIN_ID === MASTER_CHAIN_ID) {
            console.log("set sync service for master chain");
            for (let [slaverNet, slaverConfig] of Object.entries(zkLinkConfig)) {
                const chainIndex = 1 << slaverConfig.zkLinkChainId - 1;
                if ((chainIndex & ALL_CHAINS) === chainIndex && slaverConfig.zkLinkChainId !== CHAIN_ID && chainInfo.mainnet === slaverConfig.mainnet) {
                    console.log("slaver chain:", slaverNet);
                    const tx = await peripheryContract.connect(governor).setSyncService(slaverConfig.zkLinkChainId, bridgeAddr);
                    await tx.wait();
                    console.log('tx', tx.hash);
                }
            }
        } else {
            console.log("set sync service for slaver chain");
            const tx = await peripheryContract.connect(governor).setSyncService(MASTER_CHAIN_ID, bridgeAddr);
            await tx.wait();
            console.log('tx', tx.hash);
        }
    });

task("mintFaucetToken", "Mint faucet token for testnet")
    .addParam("token", "The token contract address", undefined, types.string, false)
    .addParam("to", "The account address", undefined, types.string, false)
    .addParam("amount", "The mint amount", undefined, types.string, false)
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        let tokenAddr = taskArgs.token;
        const accountAddr = taskArgs.to;
        const amount = hardhat.ethers.parseUnits(taskArgs.amount, taskArgs.decimals);
        console.log('to', accountAddr);
        console.log('amount', amount);

        const [governor] = await hardhat.ethers.getSigners();
        console.log('governor', governor.address);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
        const tokenContract = tokenFactory.attach(tokenAddr);

        console.log('Mint token...')
        const tx = await tokenContract.connect(governor).mintTo(accountAddr, amount);
        await tx.wait();
        console.log('tx', tx.hash);
    });

task("transferOwnership", "Transfer faucet token ownership")
    .addParam("token", "The token contract address", undefined, types.string, false)
    .addParam("to", "The account address", undefined, types.string, false)
    .setAction(async (taskArgs, hardhat) => {
        let tokenAddr = taskArgs.token;
        const accountAddr = taskArgs.to;
        console.log('token', tokenAddr);
        console.log('to', accountAddr);

        const [governor] = await hardhat.ethers.getSigners();
        console.log('governor', governor.address);

        const balance = await hardhat.ethers.provider.getBalance(governor.address);
        console.log('governor balance', hardhat.ethers.formatEther(balance));

        const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
        const tokenContract = tokenFactory.attach(tokenAddr);

        console.log('Transfer ownership...')
        const tx = await tokenContract.connect(governor).transferOwnership(accountAddr);
        await tx.wait();
        console.log('tx', tx.hash);
    });

task("setAuthPubkeyHash", "Set auth pubkey hash for ChangePubKey on devnet or testnet")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("address", "The account address")
    .addParam("pubkeyHash", "The new pubkey hash that will be set to account")
    .addParam("nonce", "The account latest nonce")
    .setAction(async (taskArgs, hardhat) => {
        let zkLinkProxy = taskArgs.zkLink;
        if (zkLinkProxy === undefined) {
            zkLinkProxy = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        }
        const address = taskArgs.address;
        const pubkeyHash = taskArgs.pubkeyHash;
        const nonce = taskArgs.nonce;
        console.log('zkLink', zkLinkProxy);
        console.log('address', address);
        console.log('pubkeyHash', pubkeyHash);
        console.log('nonce', nonce);

        const sender = await hardhat.ethers.getSigner(address);

        const balance = await hardhat.ethers.provider.getBalance(sender.address);
        console.log('sender eth balance', hardhat.ethers.formatEther(balance));

        const zkLinkPeripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const zkLink = zkLinkPeripheryFactory.attach(zkLinkProxy);
        const tx = await zkLink.connect(sender).setAuthPubkeyHash(pubkeyHash, nonce);
        await tx.wait();
        console.log('tx', tx.hash);
    });

task("transferMastershipOfUpgradeGatekeeper", "Set the master of UpgradeGatekeeper")
    .addParam("gatekeeper", "The UpgradeGatekeeper contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("master", "The new master address", undefined, types.string, false)
    .setAction(async (taskArgs, hardhat) => {
        let gatekeeper = taskArgs.gatekeeper;
        if (gatekeeper === undefined) {
            gatekeeper = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_GATEKEEPER);
        }
        const master = taskArgs.master;
        console.log('gatekeeper', gatekeeper);
        console.log('master', master);

        const [oldMaster] = await hardhat.ethers.getSigners();
        console.log('old master', oldMaster.address);

        const balance = await hardhat.ethers.provider.getBalance(oldMaster.address)
        console.log('old master balance', hardhat.ethers.formatEther(balance));

        const gatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
        const gatekeeperContract = gatekeeperFactory.attach(gatekeeper);

        console.log('Set new master for gatekeeper...');
        const tx = await gatekeeperContract.connect(oldMaster).transferMastership(master);
        await tx.wait();
        console.log('tx', tx.hash);
    });

task("changeGovernorOfZkLink", "Set the network governor of ZkLink")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("governor", "The new governor address", undefined, types.string, false)
    .setAction(async (taskArgs, hardhat) => {
        let zkLinkProxy = taskArgs.zkLink;
        if (zkLinkProxy === undefined) {
            zkLinkProxy = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        }
        const governor = taskArgs.governor;
        console.log('zklink', zkLinkProxy);
        console.log('governor', governor);

        const [oldGovernor] = await hardhat.ethers.getSigners();
        console.log('old governor', oldGovernor.address);

        const balance = await hardhat.ethers.provider.getBalance(oldGovernor.address);
        console.log('old governor balance', hardhat.ethers.formatEther(balance));

        const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const peripheryContract = peripheryFactory.attach(zkLinkProxy);

        console.log('Set new network governor for zklink...');
        const tx = await peripheryContract.connect(oldGovernor).changeGovernor(governor);
        await tx.wait();
        console.log('tx', tx.hash);
    });


task("setL1RemoteGateway", "Set l2 gateway address to l1 gateway")
    .addParam("l2Network", "l2 network name that gateway deployed", undefined, types.string, false)
    .setAction(async (taskArgs, hardhat) => {
        const l2Network = taskArgs.l2Network;
        console.log('l2Network', l2Network);

        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }
        console.log('is mainnet?', chainInfo.mainnet);
        const l1GatewayInfo = chainInfo.l1Gateway;
        if (l1GatewayInfo === undefined) {
            console.log('l1 gateway info not exist');
            return;
        }
        const l2ChainInfo = zkLinkConfig[l2Network];
        if (l2ChainInfo === undefined) {
            console.log('l2 chain info not exist');
            return;
        }
        const chainL1GatewayInfo = l1GatewayInfo[l2Network];
        if (chainL1GatewayInfo === undefined) {
            console.log('l1 gateway info of l2 chain not exist');
            return;
        }

        const l1GatewayLogName = logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + l2Network;
        const governorAddress = readDeployLogField(l1GatewayLogName, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);
        console.log('governor', governor.address);

        let l1GatewayAddr =  readDeployContract(l1GatewayLogName, logName.DEPLOY_GATEWAY);
        let l2GatewayAddr =  readDeployContract(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX, logName.DEPLOY_GATEWAY, l2Network);
        console.log('l1 gateway', l1GatewayAddr);
        console.log('l2 gateway', l2GatewayAddr);

        const contractFactory = await hardhat.ethers.getContractFactory(chainL1GatewayInfo.contractName);
        const contract = await contractFactory.attach(l1GatewayAddr);

        const tx = await contract.connect(governor).setRemoteGateway(l2GatewayAddr);
        await tx.wait();
        console.log("tx:", tx.hash);
    });

task("setL2RemoteGateway", "set l1 gateway address to l2 gateway")
    .setAction(async (taskArgs, hardhat) => {
        const chainInfo = zkLinkConfig[process.env.NET];
        if (chainInfo === undefined) {
            console.log('current net not support');
            return;
        }
        console.log('is mainnet?', chainInfo.mainnet);
        const l2GatewayInfo = chainInfo.l2Gateway;
        if (l2GatewayInfo === undefined) {
            console.log('l2 gateway info not exist');
            return;
        }

        let ethConfig = getEthChainConfig(zkLinkConfig, chainInfo.mainnet);
        if (ethConfig.chainConfig === undefined) {
            console.log('eth config not exist');
            return;
        }
        let l1GatewayAddr =  readDeployContract(logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + process.env.NET, logName.DEPLOY_GATEWAY, ethConfig.net);
        let l2GatewayAddr =  readDeployContract(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX, logName.DEPLOY_GATEWAY);
        const governorAddress = readDeployLogField(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);

        console.log('l1 gateway', l1GatewayAddr);
        console.log('l2 gateway', l2GatewayAddr);
        console.log('governor', governor.address);

        const contractFactory = await hardhat.ethers.getContractFactory(l2GatewayInfo.contractName);
        const contract = await contractFactory.attach(l2GatewayAddr);

        const tx = await contract.connect(governor).setRemoteGateway(l1GatewayAddr);
        await tx.wait();
        console.log("tx:", tx.hash);
    })

task("setL2GatewayToZkLink", "set gateway address to zklink")
    .setAction(async (taskArgs, hardhat) => {
        let gatewayAddr =  readDeployContract(logName.DEPLOY_L2_GATEWAY_LOG_PREFIX, logName.DEPLOY_GATEWAY);
        const governorAddress = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        const governor = await hardhat.ethers.getSigner(governorAddress);

        const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
        const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const zkLink = zkLinkFactory.attach(zkLinkProxyAddr);

        console.log('gateway', gatewayAddr);
        console.log('governor', governor.address);
        console.log('zkLink', zkLinkProxyAddr);

        const tx = await zkLink.connect(governor).setGateway(gatewayAddr);
        await tx.wait();
        console.log("tx:", tx.hash);
    })