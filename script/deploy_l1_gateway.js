const { ChainContractDeployer } = require("./utils");

task("deployZKLinkL1Gateway", "Deploy ZKLinkL1Gateway contract")
  .addParam(
    "messageService",
    "Linea message service contract address of ethereum"
  )
  .addParam("zksync", "zksync message service contract address of ethereum")
  .setAction(async (taskArgs, hardhat) => {
    const { messageService, zksync } = taskArgs;
    console.log("messageService", messageService);
    console.log("zksync", zksync);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    // deploy ZKLinkL1Gateway
    const args = [messageService, zksync];
    const contract = await deployer.deployContract("ZKLinkL1Gateway", args);
    console.log("ZKLinkL1Gateway deploy success", contract.address);
  });
