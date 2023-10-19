const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const gatewayConfig = require("./gateway");
task("deployL1Gateway", "Deploy L1 Gateway")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .addParam("targetNetwork", "L2 network name", undefined, types.string, false)
  .setAction(async (taskArgs, hardhat) => {
    const { network, upgrades, ethers } = hardhat;
    const { force, skipVerify, targetNetwork } = taskArgs;
    console.log(`
            force: ${force},
            skipVerify:${skipVerify},
            targetNetwork: ${targetNetwork}
        `);

    const config = gatewayConfig[network.name];
    if (!config) {
      throw Error("network not support");
    }
    if (!Object.keys(config).includes(targetNetwork)) {
      throw Error("targetNetwork not support");
    }
    const { initializeParams, contractName } = config[targetNetwork];
    console.log(`
      contractName: ${contractName}
      initializeParams: ${initializeParams}
      network: ${network.name}
    `);

    const { deployLogPath, deployLog } = createOrGetDeployLog(
      logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + targetNetwork
    );
    console.log("load deployLog:", deployLog);

    let instance = {
      address: "",
    };

    try {
      if (logName.DEPLOY_GATEWAY in deployLog) {
        instance.address = deployLog[logName.DEPLOY_GATEWAY];
      }

      if (!(logName.DEPLOY_GATEWAY_TARGET in deployLog) || force) {
        console.log("start deploy contract");
        const contract = await ethers.getContractFactory(contractName);
        instance = await upgrades.deployProxy(contract, initializeParams, {
          kind: "uups",
        });
        deployLog[logName.DEPLOY_GATEWAY] = instance.address;
        console.log("instance address and wait deployed:", instance.address);
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        const receipt = await instance.deployTransaction.wait()
        deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = receipt.transactionHash
        deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = receipt.blockNumber
        console.log("deployed success:", instance.address);
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      }

      const impl = await getImplementationAddress(
        hardhat.ethers.provider,
        instance.address
      );

      console.log("impl address:", impl);
      deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl;
      fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

      // verify contract
      if ((!(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) || force) && !skipVerify) {
          console.log("start verify contract");
          await verifyContractCode(hardhat, impl, []);
          deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
          fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
      }
    } catch (error) {
      console.error("error:", error);
      throw error
    } finally {
      console.log("finally log", deployLog);
    }
  });
