const {readDeployContract, readDeployLogField, getDeployLog} = require('./utils');
const logName = require('./deploy_log_name');
const {layerZero} = require('./layerzero');
const {extendAddress} = require("./op_utils");
const gatewayConfig = require("./gateway")

async function governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr, tokenDecimals) {
  console.log('Adding new ERC20 token to network: ', tokenAddr);
  const governanceFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
  const governance = governanceFactory.attach(governanceAddr);
  const tx = await governance.connect(governor).addToken(tokenId, tokenAddr, tokenDecimals);
  console.log('tx hash: ', tx.hash);
  const receipt = await tx.wait();
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

    const balance = await governor.getBalance();
    console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

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

    const balance = await sender.getBalance();
    console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));
    const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
    const erc20 = erc20Factory.attach(token);
    const tokenBalance = await erc20.connect(sender).balanceOf(sender.address);
    console.log('sender token balance', hardhat.ethers.utils.formatEther(tokenBalance, decimals));

    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
    const zkLink = zkLinkFactory.attach(zkLinkProxy);
    const amountInWei = hardhat.ethers.utils.parseUnits(amount, decimals);
    const allowance = await erc20.connect(sender).allowance(sender.address, zkLink);
    if (allowance.isZero()) {
      console.log('add unlimited allowance');
      const tx = await erc20.connect(sender).approve(zkLink, hardhat.ethers.constants.MaxUint256);
      console.log('approve tx hash', tx.hash);
    }
    const tx = await zkLink.connect(sender).depositERC20(token, amountInWei, extendAddress(sender.address), 0, false);
    console.log('tx', tx.hash);
  });

task("setDestinations", "Set layerzero bridge destinations (only support testnet)")
  .addParam("dest", "The destination net env name")
  .setAction(async (taskArgs, hardhat) => {
    const dest = taskArgs.dest;
    console.log('dest env', dest);
    if (process.env.NET === dest) {
      console.log('dest env must not be the same with current env net')
      return;
    }
    const lzInfo = layerZero[dest];
    if (lzInfo === undefined) {
      console.log('invalid dest env')
      return;
    }

    const bridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE);
    const governorAddress = readDeployLogField(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
    const governor = await hardhat.ethers.getSigner(governorAddress);

    console.log('bridge', bridgeAddr);
    console.log('governor', governor.address);

    const balance = await governor.getBalance();
    console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

    const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
    const bridgeContract = bridgeFactory.attach(bridgeAddr);

    console.log('Set destination %s for %s...', dest, process.env.NET);
    try {
      const dstBridgeAddr = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE, dest);
      const tx = await bridgeContract.connect(governor).setDestination(lzInfo.chainId, dstBridgeAddr);
      console.log('tx', tx.hash);
    } catch (error) {
      console.log('Set bridge destination failed: ' + error);
    }
  });

task("addBridge", "Add bridge to zkLink")
  .addParam("bridge", "The bridge address (default get from deploy log)", undefined, types.string, true)
  .setAction(async (taskArgs, hardhat) => {
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

    const balance = await governor.getBalance();
    console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    const peripheryContract = peripheryFactory.attach(zkLinkProxyAddr);
    console.log('add bridge to zkLink...');
    const tx = await peripheryContract.connect(governor).addBridge(bridgeAddr);
    console.log('tx', tx.hash);
  });

task("mintFaucetToken", "Mint faucet token for testnet")
  .addParam("token", "The token contract address", undefined, types.string, false)
  .addParam("to", "The account address", undefined, types.string, false)
  .addParam("amount", "The mint amount", undefined, types.string, false)
  .addParam("decimals", "The token decimals", 18, types.int, true)
  .setAction(async (taskArgs, hardhat) => {
    let tokenAddr = taskArgs.token;
    const accountAddr = taskArgs.to;
    const amount = hardhat.ethers.utils.parseUnits(taskArgs.amount, taskArgs.decimals);
    console.log('to', accountAddr);
    console.log('amount', amount);

    const [governor] = await hardhat.ethers.getSigners();
    console.log('governor', governor.address);

    const balance = await governor.getBalance();
    console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

    const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
    const tokenContract = tokenFactory.attach(tokenAddr);

    console.log('Mint token...')
    const tx = await tokenContract.connect(governor).mintTo(accountAddr, amount);
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

    const balance = await governor.getBalance();
    console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

    const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
    const tokenContract = tokenFactory.attach(tokenAddr);

    console.log('Transfer ownership...')
    const tx = await tokenContract.connect(governor).transferOwnership(accountAddr);
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

    const balance = await sender.getBalance();
    console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));

    const zkLinkPeripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    const zkLink = zkLinkPeripheryFactory.attach(zkLinkProxy);
    const tx = await zkLink.connect(sender).setAuthPubkeyHash(pubkeyHash, nonce);
    console.log('tx', tx.hash);
  });

task("zkLinkStatus", "Query zkLink status")
  .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
  .addParam("property", "The zkLink property", undefined, types.string, false)
  .setAction(async (taskArgs, hardhat) => {
    let zkLinkProxy = taskArgs.zkLink;
    let property = taskArgs.property;
    if (zkLinkProxy === undefined) {
      zkLinkProxy = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
    }
    console.log('zkLink', zkLinkProxy);
    console.log('property', property);

    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
    const zkLink = zkLinkFactory.attach(zkLinkProxy);
    const result = await zkLink[property]();
    console.log('result:%s', result);
  });

task("estimateZkLinkBlockBridgeFees", "Get fee for bridge block")
  .addParam("lzBridge", "The layerzero bridge contract address (default get from deploy log)", undefined, types.string, true)
  .addParam("dest", "The dest net env name")
  .addParam("syncHash", "The block sync hash")
  .addParam("progress", "The sync progress of current chain")
  .addParam("useZro", "True if use zro to pay fee", false, types.boolean, true)
  .addParam("adapterParams", "Adapter params for relayer", "0x", types.string, true)
  .setAction(async (taskArgs, hardhat) => {
    let lzBridge = taskArgs.lzBridge;
    let dest = taskArgs.dest;
    let syncHash = taskArgs.syncHash;
    let progress = taskArgs.progress;
    let useZro = taskArgs.useZro;
    let adapterParams = taskArgs.adapterParams;
    if (lzBridge === undefined) {
      lzBridge = readDeployContract(logName.DEPLOY_LZ_BRIDGE_LOG_PREFIX, logName.DEPLOY_LOG_LZ_BRIDGE);
    }
    const lzInfo = layerZero[dest];
    if (lzInfo === undefined) {
      console.log('%s layerzero not support', dest);
      return;
    }
    console.log('lzBridge', lzBridge);
    console.log('dest', dest);
    console.log('syncHash', syncHash);
    console.log('progress', progress);
    console.log('useZro', useZro);
    console.log('adapterParams', adapterParams);

    const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
    const bridgeContract = bridgeFactory.attach(lzBridge);

    const result = await bridgeContract.estimateZkLinkBlockBridgeFees(lzInfo.chainId, syncHash, progress, useZro, adapterParams);
    console.log('result:%s', result);
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

    const balance = await oldMaster.getBalance();
    console.log('old master balance', hardhat.ethers.utils.formatEther(balance));

    const gatekeeperFactory = await hardhat.ethers.getContractFactory('UpgradeGatekeeper');
    const gatekeeperContract = gatekeeperFactory.attach(gatekeeper);

    console.log('Set new master for gatekeeper...');
    const tx = await gatekeeperContract.connect(oldMaster).transferMastership(master);
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

    const balance = await oldGovernor.getBalance();
    console.log('old governor balance', hardhat.ethers.utils.formatEther(balance));

    const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    const peripheryContract = peripheryFactory.attach(zkLinkProxy);

    console.log('Set new network governor for zklink...');
    const tx = await peripheryContract.connect(oldGovernor).changeGovernor(governor);
    console.log('tx', tx.hash);
  });


task(
  "setL1RemoteGateway",
  "Set l2 gateway address to l1 gateway"
)
  .addParam("l2Network", "l2 network name that gateway deployed")
  .setAction(async (taskArgs, hardhat) => {
    const {ethers, network} = hardhat;

    const {l2Network} = taskArgs;
    console.log("l2Network", l2Network);

    // get l2 gateway contract info
    const {contractName: l2ContractName} = gatewayConfig[l2Network];
    console.log(`
                logName:${logName.DEPLOY_GATEWAY_LOG_PREFIX + '_' + l2ContractName}
                contractName: ${l2ContractName}
                env: ${process.env.NET}
        `)
    const {deployLogPath, deployLog: l2GatewayDeployedInfo} = getDeployLog(
      logName.DEPLOY_GATEWAY_LOG_PREFIX + '_' + l2ContractName,
      l2Network
    );
    console.log("l2 gateway deploy info:", l2GatewayDeployedInfo)


    // get current network contract info
    const {contractName: l1ContractName} = gatewayConfig[network.name][l2Network]
    const {deployLog: l1GatewayDeployedInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + l1ContractName)
    const contractFactory = await ethers.getContractFactory(l1ContractName)
    const contract = await contractFactory.attach(l1GatewayDeployedInfo[logName.DEPLOY_GATEWAY])

    // get signer
    const signer = (await ethers.getSigners())[0]
    const tx = await contract.connect(signer).setRemoteGateway(l2GatewayDeployedInfo[logName.DEPLOY_GATEWAY])
    console.log("tx", tx.hash)
  });

task("setL2RemoteGateway", "set l1 gateway address to l2 gateway")
  .addParam("l1Network", "l1 network name that gateway deployed")
  .setAction(async (taskArgs, hardhat) => {
    const {ethers, network} = hardhat
    const {l1Network} = taskArgs
    console.log("l1Network", l1Network)

    // get l1 gateway contract info
    const {contractName: l1ContractName} = gatewayConfig[l1Network][network.name]
    const {deployLog: l1GatewayDeployedInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + l1ContractName, l1Network)
    console.log({l1GatewayDeployedInfo})

    // get l2 gateway contract info
    const {contractName: l2ContractName} = gatewayConfig[network.name]
    const {deployLog: l2GatewayDeployedInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + l2ContractName, network.name)
    console.log({l2GatewayDeployedInfo})
    const contractFactory = await ethers.getContractFactory(l2ContractName)
    const contract = await contractFactory.attach(l2GatewayDeployedInfo[logName.DEPLOY_GATEWAY])

    // get signer
    const signer = (await ethers.getSigners())[0]

    const tx = await contract.connect(signer).setRemoteGateway(l1GatewayDeployedInfo[logName.DEPLOY_GATEWAY])
    console.log("tx:", tx.hash)
  })

task("setZkLinkToL1Gateway", "set zkLink address to l1 gateway")
  .addParam("l2Network", "l2 network name that gateway deployed")
  .setAction(async (taskArgs, hardhat) => {
    const {network} = hardhat
    const {l2Network} = taskArgs
    console.log("l2Network", l2Network)

    // get zklink contract info
    const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);


    // get l1 network gateway contract
    const {contractName} = gatewayConfig[network.name][l2Network];
    const {deployLog: gatewayDeployInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + contractName)
    const contractFactory = await ethers.getContractFactory(contractName)
    const contract = await contractFactory.attach(gatewayDeployInfo[logName.DEPLOY_GATEWAY])

    // get signer
    const signer = (await ethers.getSigners())[0]
    const tx = await contract.connect(signer).setZkLink(zkLinkProxyAddr)
    console.log("tx: ", tx.hash)
  })

task("setZkLinkToL2Gateway", "set zkLink address to l2 gateway")
  .setAction(async (taskArgs, hardhat) => {
    const {network} = hardhat
    const {l1Network} = taskArgs
    console.log("l1Network", l1Network)

    // get zklink contract info
    const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);

    // get l2 network gateway contract
    const {contractName} = gatewayConfig[network.name]
    const {deployLog: gatewayDeployInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + contractName)
    const contractFactory = await ethers.getContractFactory(contractName)
    const contract = contractFactory.attach(gatewayDeployInfo[logName.DEPLOY_GATEWAY])

    // get signer
    const signer = (await ethers.getSigners())[0]

    const tx = await contract.connect(signer).setZkLink(zkLinkProxyAddr)
    console.log("tx: ", tx.hash)
  })

task("setL1GatewayToZkLink", "set gateway address to zklink")
  .addParam("l2Network", "l2 network name that gateway deployed")
  .setAction(async (taskArgs, hardhat) => {
    const {network} = hardhat
    const {l2Network} = taskArgs
    console.log("l2Network", l2Network)

    // get gateway deploy info
    const {contractName} = gatewayConfig[network.name][l2Network]
    const {deployLog: gatewayDeployInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + contractName)

    // get zklink deploy info
    const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink')
    const contract = zkLinkFactory.attach(zkLinkProxyAddr)

    // get signer
    const signer = (await ethers.getSigners())[0]
    const tx = await contract.connect(signer).setGateway(gatewayDeployInfo[logName.DEPLOY_GATEWAY])
    console.log("tx:", tx.hash)
  })

task("setL2GatewayToZkLink", "set gateway address to zklink")
  .setAction(async (taskArgs, hardhat) => {
    const {ethers, network} = hardhat

    // get gateway deploy info
    const {contractName} = gatewayConfig[network.name]
    const {deployLog: gatewayDeployInfo} = getDeployLog(logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + contractName)

    // get zklink deploy info
    const zkLinkProxyAddr = readDeployContract(logName.DEPLOY_ZKLINK_LOG_PREFIX, logName.DEPLOY_LOG_ZKLINK_PROXY);
    const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink')
    const contract = zkLinkFactory.attach(zkLinkProxyAddr)

    // get signer
    const signer = (await ethers.getSigners())[0]
    const tx = await contract.connect(signer).setGateway(gatewayDeployInfo[logName.DEPLOY_GATEWAY])
    console.log("tx:", tx.hash)
  })