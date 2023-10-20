const fs = require("fs")
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode,getDeployLog, createOrGetDeployLog} = require("./utils")
const logName = require("./deploy_log_name")
const gatewayConfig = require("./gateway");

task("upgradeL1Gateway","upgrade l1 gateway")
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .addParam("targetNetwork", "L2 network name", undefined, types.string, false)
  .setAction(async (taskArgs,hardhat)=>{
    const { ethers,network,upgrades } = hardhat
    const { skipVerify,targetNetwork } = taskArgs
    console.log("skipVerify",skipVerify)
    console.log("targetNetwork",targetNetwork)

    const config = gatewayConfig[network.name];
    if (!config) {
      throw Error("network not support");
    }
    if (!Object.keys(config).includes(targetNetwork)) {
      throw Error("targetNetwork not support");
    }
    const { contractName } = config[targetNetwork];
    console.log("contractName",contractName)

    const { deployLogPath, deployLog } = createOrGetDeployLog(
      logName.DEPLOY_L1_GATEWAY_LOG_PREFIX + "_" + targetNetwork
    );
    console.log("load deployLog:", deployLog);

    const contractFactory = await ethers.getContractFactory(contractName)
    const instance = await upgrades.upgradeProxy(deployLog[logName.DEPLOY_GATEWAY],contractFactory)

    await instance.deployTransaction.wait()
    const impl = await getImplementationAddress(ethers.provider,instance.address)
    deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl
    console.log("impl:",impl)
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))

    if (!skipVerify) {
      console.log("start verify contract")
      await verifyContractCode(hardhat,impl,[])
      deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true
      fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
    }
  })