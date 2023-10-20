const fs = require("fs")
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode,getDeployLog } = require("./utils")
const logName = require("./deploy_log_name")

task("upgradeL2Gateway","upgrade l2 gateway")
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .setAction(async (taskArgs,hardhat)=>{
    const { ethers,upgrades } = hardhat
    const { skipVerify } = taskArgs
    console.log("skipVerify",skipVerify)

    const { deployLogPath, deployLog } = getDeployLog(
        logName.DEPLOY_L2_GATEWAY_LOG_PREFIX
    );

    console.log({deployLog})
    const LineaL2Gateway = await ethers.getContractFactory("LineaL2Gateway")
    const instance = await upgrades.upgradeProxy(deployLog[logName.DEPLOY_GATEWAY],LineaL2Gateway)
    console.log("instance:",instance.address)
    deployLog[logName.DEPLOY_GATEWAY] = instance.address
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))

    const receipt = await instance.deployTransaction.wait()
    deployLog[logName.DEPLOY_LOG_DEPLOY_TX_HASH] = receipt.transactionHash
    deployLog[logName.DEPLOY_LOG_DEPLOY_BLOCK_NUMBER] = receipt.blockNumber
    const impl = await getImplementationAddress(ethers.provider,instance.address)
    console.log("impl",impl)
    deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))

    if (!skipVerify) {
        console.log("start verify contract")
        await verifyContractCode(hardhat,impl,[])
        deployLog[logName.DEPLOY_LOG_VERIFIER_TARGET_VERIFIED] = true
        fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
    }
  })