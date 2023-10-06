const { ChainContractDeployer } = require("./utils");

task("deployLineaGateway", "Deploy linea gateway contract")
  .addParam("messageService", "linea l2 message service contract address")
  .addParam("zklink", "zklink contract address on linea")
  .setAction(async (taskArgs, hardhat) => {
    const { messageService, zklink } = taskArgs;
    console.log("messageService", messageService);
    console.log("zklink contract address", zklink);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    const args = [messageService, zklink];
    const contract = await deployer.deployContract("LineaGateway", args);
    console.log("Linea gateway deployed:", contract.address);
  });
