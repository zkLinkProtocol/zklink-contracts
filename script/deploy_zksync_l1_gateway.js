const { ChainContractDeployer } = require("./utils");

task("deployZKSyncL1Gateway", "deploy zksync l1 gateway contract")
  .addParam("zksync", "zksync l1 messageService contract address")
  .setAction(async (taskArgs, hardhat) => {
    const { zksync } = taskArgs;
    console.log("zksync contract address", zksync);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    const args = [zksync];
    const contract = await deployer.deployContract("ZKSyncL1Gateway", args);
    console.log("ZKSyncL1Gateway deployed: ", contract.address);
  });
