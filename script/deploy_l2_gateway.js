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
      logName.DEPLOY_GATEWAY_LOG_PREFIX + "_" + contractName
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
        await instance.deployed();

        console.log("deployed success:", instance.address);
      }

      const impl = await getImplementationAddress(
        hardhat.ethers.provider,
        instance.address
      );

      console.log("impl address:", impl);
      deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl;

      // verify contract
      if (
        !(logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED in deployLog) ||
        !taskArgs.skipVerify
      ) {
        console.log("start verify contract");
        await verifyContractCode(hardhat, impl, []);
        deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true;
      }
    } catch (error) {
      console.error("error:", error);
    } finally {
      console.log("write deploy log", deployLog);
      fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
    }
  });
