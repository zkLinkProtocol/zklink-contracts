const fs = require("fs")
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { verifyContractCode,getDeployLog } = require("./utils")
const logName = require("./deploy_log_name")

task("upgradeL2Gateway","upgrade l2 gateway")
  .setAction(async (taskArgs,hardhat)=>{
    const { ethers,upgrades } = hardhat

    const { deployLogPath, deployLog } = getDeployLog(
        logName.DEPLOY_L2_GATEWAY_LOG_PREFIX
    );

    console.log({deployLog})
    const LineaL2Gateway = await ethers.getContractFactory("LineaL2Gateway")
    const instance = await upgrades.upgradeProxy(deployLog[logName.DEPLOY_GATEWAY],LineaL2Gateway)
    console.log("instance:",instance.address)
    deployLog[logName.DEPLOY_GATEWAY] = instance.address
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))

    await instance.deployTransaction.wait()
    const impl = await getImplementationAddress(ethers.provider,instance.address)
    console.log("impl",impl)
    deployLog[logName.DEPLOY_GATEWAY_TARGET] = impl
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
  })