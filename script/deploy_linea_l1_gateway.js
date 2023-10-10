const { ChainContractDeployer } = require("./utils");

task("deployLineaL1Gateway", "Deploy LineaL1Gateway")
  .addParam("messageService", "Linea L1 message service contract address")
  .setAction(async (taskArgs, hardhat) => {
    const { messageService } = taskArgs;
    console.log("messageService", messageService);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    // deploy LineaL1Gateway
    const args = [messageService];
    const contract = await deployer.deployContract("LineaL1Gateway", args);
    console.log("LineaL1Gateway deploy success", contract.address);
  });
