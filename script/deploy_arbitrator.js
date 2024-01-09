const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog, ChainContractDeployer, getDeployTx,
    readDeployContract,
    readDeployLogField
} = require("./utils");
const logName = require("./deploy_log_name");
const {zkLinkConfig} = require("./zklink_config");

task("deployArbitrator", "Deploy arbitrator")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .setAction(async (taskArgs, hardhat) => {
      let force = taskArgs.force;
      let skipVerify = taskArgs.skipVerify;
      console.log('force redeploy all contracts?', force);
      console.log('skip verify contracts?', skipVerify);

      const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_ARBITRATOR_LOG_PREFIX);

      const contractDeployer = new ChainContractDeployer(hardhat);
      await contractDeployer.init();
      const deployerWallet = contractDeployer.deployerWallet;
      deployLog[logName.DEPLOY_LOG_GOVERNOR] = deployerWallet.address;
      fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

      // deploy arbitrator
      let arbitratorAddr;
      if (!(logName.DEPLOY_LOG_ARBITRATOR in deployLog) || force) {
          console.log('deploy arbitrator...');
          const contract = await contractDeployer.deployProxy('Arbitrator', []);
          const transaction = await getDeployTx(contract);
          arbitratorAddr = await contract.getAddress();
          deployLog[logName.DEPLOY_LOG_ARBITRATOR] = arbitratorAddr;
          deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = transaction.hash;
          deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = transaction.blockNumber;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      } else {
          arbitratorAddr = deployLog[logName.DEPLOY_LOG_ARBITRATOR];
      }
      console.log('arbitrator', arbitratorAddr);

      let arbitratorTargetAddr;
      if (!(logName.DEPLOY_LOG_ARBITRATOR_TARGET in deployLog) || force) {
          console.log('get arbitrator target...');
          arbitratorTargetAddr = await getImplementationAddress(
              hardhat.ethers.provider,
              arbitratorAddr
          );
          deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET] = arbitratorTargetAddr;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      } else {
          arbitratorTargetAddr = deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET];
      }
      console.log("arbitrator gateway target", arbitratorTargetAddr);

      // verify contract
      if ((!(logName.DEPLOY_LOG_ARBITRATOR_TARGET_VERIFIED in deployLog) || force) && !taskArgs.skipVerify) {
          await verifyContractCode(hardhat, arbitratorTargetAddr, []);
          deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET_VERIFIED] = true;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      }
  });

task("configArbitrator", "Bind gateway address with arbitrator")
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
        const l2ChainInfo = zkLinkConfig[l2Network];
        if (l2ChainInfo === undefined) {
            console.log('l2 chain info not exist');
            return;
        }
        if (l2ChainInfo.mainnet !== chainInfo.mainnet) {
            console.log('mainnet not match');
            return;
        }

        let arbitratorGovernorAddress = readDeployLogField(logName.DEPLOY_ARBITRATOR_LOG_PREFIX, logName.DEPLOY_LOG_GOVERNOR);
        let arbitratorGovernor = await hardhat.ethers.getSigner(arbitratorGovernorAddress);
        console.log('arbitrator governor', arbitratorGovernor.address);
        let arbitratorAddr =  readDeployContract(logName.DEPLOY_ARBITRATOR_LOG_PREFIX, logName.DEPLOY_LOG_ARBITRATOR);
        console.log('arbitrator', arbitratorAddr);

        const l1GatewayLogName = logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + l2Network;
        let gatewayGovernorAddress = readDeployLogField(l1GatewayLogName, logName.DEPLOY_LOG_GOVERNOR);
        let gatewayGovernor = await hardhat.ethers.getSigner(gatewayGovernorAddress);
        console.log('l1 gateway governor', gatewayGovernor.address);
        let l1GatewayAddr =  readDeployContract(l1GatewayLogName, logName.DEPLOY_GATEWAY);
        console.log('l1 gateway', l1GatewayAddr);

        console.log('set gateway to arbitrator...');
        const arbitratorContractFactory = await hardhat.ethers.getContractFactory('Arbitrator');
        const arbitrator = await arbitratorContractFactory.attach(arbitratorAddr);
        let tx = await arbitrator.connect(arbitratorGovernor).setGateway(l2ChainInfo.zkLinkChainId, l1GatewayAddr);
        await tx.wait();
        console.log("tx:", tx.hash);

        console.log('set arbitrator to gateway...');
        const gateway = await hardhat.ethers.getContractAt('L1BaseGateway', l1GatewayAddr);
        tx = await gateway.connect(gatewayGovernor).setArbitrator(arbitratorAddr);
        await tx.wait();
        console.log("tx:", tx.hash);
    });

task("upgradeArbitrator","Upgrade arbitrator")
    .addParam("skipVerify", "Skip verify", false, types.boolean, true)
    .setAction(async (taskArgs,hardhat)=>{
        let skipVerify = taskArgs.skipVerify;
        console.log("skipVerify", skipVerify);

        const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_ARBITRATOR_LOG_PREFIX);
        const contractAddr = deployLog[logName.DEPLOY_LOG_ARBITRATOR];
        if (contractAddr === undefined) {
            console.log('arbitrator address not exist');
            return;
        }
        console.log('arbitrator', contractAddr);
        const oldContractTargetAddr = deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET];
        if (oldContractTargetAddr === undefined) {
            console.log('arbitrator target address not exist');
            return;
        }
        console.log('arbitrator old target', oldContractTargetAddr);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        console.log("upgrade arbitrator...");
        const contract = await contractDeployer.upgradeProxy('Arbitrator', contractAddr);
        const tx = await getDeployTx(contract);
        console.log('upgrade tx', tx.hash);
        const newContractTargetAddr = await getImplementationAddress(hardhat.ethers.provider, contractAddr);
        deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET] = newContractTargetAddr;
        console.log("arbitrator new target", newContractTargetAddr);
        fs.writeFileSync(deployLogPath,JSON.stringify(deployLog));

        if (!skipVerify) {
            await verifyContractCode(hardhat, newContractTargetAddr, []);
            deployLog[logName.DEPLOY_LOG_ARBITRATOR_TARGET_VERIFIED] = true;
            fs.writeFileSync(deployLogPath,JSON.stringify(deployLog));
        }
    })