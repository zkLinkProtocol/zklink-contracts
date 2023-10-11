const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const gatewayConfig = require("./gateway");

task("deployGateway", "Deploy Gateway")
  .addParam("force", "Fore redeploy all contracts", false, types.boolean, true)
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .addParam(
    "l2Network",
    "(required) match L1Gateway contract based on L2 network name.require eq: 'Linea' or 'ZKSync'",
    undefined,
    types.string,
    false
  )
  .setAction(async (taskArgs, hardhat) => {
    const { network, upgrades, ethers } = hardhat;

    const { force, skipVerify, l2Network } = taskArgs;
    console.log("force:", force);
    console.log("skipVerify", skipVerify);
    console.log("l2Network", taskArgs.l2Network);

    const config = gatewayConfig[network.name];
    if (!config.length) {
      throw new Error("NET not support");
    }

    if (!["Linea", "ZKSync"].includes(l2Network)) {
      throw new Error("require l2Network to equal Linea or ZKSync");
    }

    const gateway = config.filter((item) => {
      return item.l2Network === l2Network;
    });

    if (!gateway.length) {
      throw new Error("No l2Network matched");
    }

    const { initializeParams, contractName } = gateway[0];
    console.log(`
        contractName: ${contractName}
        initializeParams: ${initializeParams}
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
      console.error("error happend:", error);
    } finally {
      console.log("write deploy log", deployLog);
      fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
    }
  });
