const BaseConfig = require("../hardhat.base.config")
// require("@matterlabs/hardhat-zksync-deploy")
require("@matterlabs/hardhat-zksync-solc");
// require("@matterlabs/hardhat-zksync-verify");

module.exports = Object.assign({},BaseConfig, {
  network: {
    "zksync": true,
  },
  paths: {
    sources: "../contracts",
    script: "../script"
  }
})

