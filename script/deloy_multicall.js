const fs = require("fs")
const { verifyContractCode,createOrGetDeployLog,ChainContractDeployer } = require("./utils")
const logName = require("./deploy_log_name")

task("deployMulticall","Deploy multicall contract")
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .addParam("force", "force deploy", false, types.boolean, true)
  .setAction(async (taskArgs,hardhat)=>{
  const { skipVerify,force } = taskArgs
  const deployer = new ChainContractDeployer(hardhat)
  await deployer.init()

  const { deployLogPath,deployLog } = createOrGetDeployLog(logName.DEPLOY_MULTICALL_LOG_PREFIX)
  console.log("deployLog",deployLog)

  if (!deployLog[logName.DEPLOY_MULTICALL] || force) {
    const multicall = await deployer.deployContract("MultiCall",[])
    deployLog[logName.DEPLOY_MULTICALL] = await multicall.getAddress()
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
    console.log("deployLog:",deployLog)
  }

  if (!skipVerify) {
    await verifyContractCode(hardhat,await multicall.getAddress(),[])
    deployLog[logName.DEPLOY_MULTICALL_VERIFIED] = true
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
  }
})