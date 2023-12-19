const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const gatewayConfig = require("./gateway");

task("deployL2Gateway", "Deploy L2 Gateway")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .setAction(async (taskArgs, hardhat) => {
    const { network, upgrades, ethers } = hardhat;
    const config = gatewayConfig[network.name];
    if (!config) {
      throw Error("network not support");
    }
    const { initializeParams, contractName } = config;
    console.log(`
        contractName:${contractName}
        initializeParams:${initializeParams}
        network: ${network.name}
    `);

    const { deployLogPath, deployLog } = createOrGetDeployLog(
      logName.DEPLOY_L2_GATEWAY_LOG_PREFIX
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
        const tx = await upgrades.deployProxy(contract, initializeParams, {
          kind: "uups",
        });
        instance.address = await tx.getAddress()
        deployLog[logName.DEPLOY_GATEWAY] = instance.address;
        console.log("instance address and wait deployed:", instance.address);
        fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));

        const receipt = await tx.waitForDeployment()
        console.log("deployed success:", instance.address);
        const transaction = await receipt.deploymentTransaction().getTransaction()
        deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = transaction.hash
        deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = transaction.blockNumber
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
      if ((!(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) || force) && !taskArgs.skipVerify) {
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
