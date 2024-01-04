const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const {zkLinkConfig} = require("./zklink_config");

task("deployL1Gateway", "Deploy L1 Gateway")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .addParam("targetNetwork", "L2 network name", undefined, types.string, false)
  .setAction(async (taskArgs, hardhat) => {
      let force = taskArgs.force;
      let skipVerify = taskArgs.skipVerify;
      let targetNetwork = taskArgs.targetNetwork;
      console.log('force redeploy all contracts?', force);
      console.log('skip verify contracts?', skipVerify);
      console.log('target network', targetNetwork);

      const chainInfo = zkLinkConfig[process.env.NET];
      if (chainInfo === undefined) {
          console.log('current net not support');
          return;
      }
      const l1GatewayInfo = chainInfo.l1Gateway;
      if (l1GatewayInfo === undefined) {
          console.log('l1 gateway config not exist');
          return;
      }
      const l2ChainInfo = zkLinkConfig[targetNetwork];
      if (l2ChainInfo === undefined) {
          console.log('l2 chain info not exist');
          return;
      }
      const chainL1GatewayInfo = l1GatewayInfo[targetNetwork];
      if (chainL1GatewayInfo === undefined) {
          console.log('l1 gateway info of l2 chain not exist');
          return;
      }

      const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + targetNetwork);
      // deploy l1 gateway
      let gatewayAddr;
      if (!(logName.DEPLOY_GATEWAY in deployLog) || force) {
          console.log('deploy l1 gateway...');
          const contractFactory = await hardhat.ethers.getContractFactory(chainL1GatewayInfo.contractName);
          const contract = await hardhat.upgrades.deployProxy(contractFactory, chainL1GatewayInfo.initializeParams, {kind: "uups"});
          await contract.waitForDeployment();
          const transaction = await contract.deploymentTransaction().getTransaction();
          gatewayAddr = await contract.getAddress();
          deployLog[logName.DEPLOY_GATEWAY] = gatewayAddr;
          deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = transaction.hash;
          deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = transaction.blockNumber;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      } else {
          gatewayAddr = deployLog[logName.DEPLOY_GATEWAY];
      }
      console.log('l1 gateway', gatewayAddr);

      let gatewayTargetAddr;
      if (!(logName.DEPLOY_GATEWAY_TARGET in deployLog) || force) {
          console.log('get l1 gateway target...');
          gatewayTargetAddr = await getImplementationAddress(
              hardhat.ethers.provider,
              gatewayAddr
          );
          deployLog[logName.DEPLOY_GATEWAY_TARGET] = gatewayTargetAddr;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      } else {
          gatewayTargetAddr = deployLog[logName.DEPLOY_GATEWAY_TARGET];
      }
      console.log("l1 gateway target", gatewayTargetAddr);

      // verify contract
      if ((!(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) || force) && !taskArgs.skipVerify) {
          await verifyContractCode(hardhat, gatewayTargetAddr, []);
          deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      }
  });
