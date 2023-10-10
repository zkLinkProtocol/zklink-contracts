const fs = require("fs");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode, createOrGetDeployLog } = require("./utils");
const logName = require("./deploy_log_name");
const gateayConfig = require("./gateway");

task("deployGateway", "Deploy Gateway").setAction(async (taskArgs, hardhat) => {
  const { network, upgrades, ethers } = hardhat;
  const config = gateayConfig[network.name];
  for (const contractName in config) {
    if (Object.hasOwnProperty.call(config, contractName)) {
      const { initializeParams } = config[contractName];
      console.log(`
        contractName: ${contractName}
        initializeParams: ${initializeParams}
        network: ${network.name}
      `);

      const contract = await ethers.getContractFactory(contractName);
      const instance = await upgrades.deployProxy(contract, initializeParams, {
        kind: "uups",
      });
      await instance.deployed();

      const impl = await getImplementationAddress(
        hardhat.ethers.provider,
        instance.address
      );

      const { deployLogPath, deployLog } = createOrGetDeployLog(
        logName.DEPLOY_GATEWAY_LOG_PREFIX
      );

      deployLog[logName.DEPLOY_GATEWAY] = instance.address;
      deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl;

      // verify contract
      await verifyContractCode(hardhat, impl, []);

      fs.writeFileSync(deployLogPath, JSON.stringify(deployLog));
    }
  }
});
