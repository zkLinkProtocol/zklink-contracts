const fs = require("fs")
const { verifyContractCode,createOrGetDeployLog,ChainContractDeployer } = require("./utils")
const logName = require("./deploy_log_name")

task("deployMulticall","Deploy multicall contract")
  .addParam("skipVerify", "Skip verify", false, types.boolean, true)
  .setAction(async (taskArgs,hardhat)=>{
  const { skipVerify } = taskArgs
  const deployer = new ChainContractDeployer(hardhat)
  await deployer.init()

  const { deployLogPath,deployLog } = createOrGetDeployLog(logName.DEPLOY_MULTICALL_LOG_PREFIX)
  console.log("deployLog",deployLog)

  const multicall = await deployer.deployContract("MultiCall",[])
  deployLog[logName.DEPLOY_MULTICALL] = multicall.address
  fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))

  if (!skipVerify) {
    await verifyContractCode(hardhat,multicall.address,[])
    deployLog[logName.DEPLOY_MULTICALL_VERIFIED] = true
    fs.writeFileSync(deployLogPath,JSON.stringify(deployLog))
  }
})