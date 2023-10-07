const { ChainContractDeployer } = require("./utils");

task("deployZKSyncL2Gateway", "deploy zksync gateway contract")
  .addParam("zklink", "zklink contract address on zksync")
  .setAction(async (taskArgs, hardhat) => {
    const { zklink } = taskArgs;
    console.log("zklink contract address", zklink);

    const deployer = new ChainContractDeployer(hardhat);
    await deployer.init();

    const args = [zklink];
    const contract = await deployer.deployContract("ZKSyncL2Gateway", args);
    console.log("ZKSyncL2Gateway deployed: ", contract.address);
  });
