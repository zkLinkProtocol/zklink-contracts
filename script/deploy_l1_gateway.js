const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const {zkLinkConfig} = require("./zklink_config");

task("deployL1Gateway", "Deploy L1 Gateway")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .setAction(async (taskArgs, hardhat) => {
      let force = taskArgs.force;
      let skipVerify = taskArgs.skipVerify;
      console.log('force redeploy all contracts?', force);
      console.log('skip verify contracts?', skipVerify);

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

      const ALL_CHAINS = hardhat.config.solpp.defs.ALL_CHAINS;
      for (const chainL1GatewayInfo of l1GatewayInfo) {
          const { net, contractName, initializeParams } = chainL1GatewayInfo;
          const targetChainConfig = zkLinkConfig[net];
          if (targetChainConfig === undefined) {
              console.log('target chain config not exist', net);
              continue;
          }
          const chainIndex = 1 << targetChainConfig.zkLinkChainId - 1;
          if ((chainIndex & ALL_CHAINS) !== chainIndex) {
              console.log('skip target chain', net);
              continue;
          }

          const { deployLogPath, deployLog } = createOrGetDeployLog(logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + net);
          // deploy l1 gateway
          let gatewayAddr;
          if (!(logName.DEPLOY_GATEWAY in deployLog) || force) {
              console.log('deploy l1 gateway...');
              const contractFactory = await hardhat.ethers.getContractFactory(contractName);
              const contract = await hardhat.upgrades.deployProxy(contractFactory, initializeParams, {kind: "uups"});
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
      }
  });
