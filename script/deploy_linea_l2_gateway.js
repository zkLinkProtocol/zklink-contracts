const { ChainContractDeployer } = require("./utils");

task("deployLineaL2Gateway", "Deploy linea l2 gateway contract")
  .addParam("messageService", "linea l2 message service contract address")
  .addParam("zklink", "zklink contract address on linea")
  .setAction(async (taskArgs, hardhat) => {
    const { messageService, zklink } = taskArgs;
    console.log("messageService", messageService);
    console.log("zklink contract address", zklink);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    const args = [messageService, zklink];
    const contract = await deployer.deployContract("LineaL2Gateway", args);
    console.log("LineaL2Gateway deployed:", contract.address);
  });
