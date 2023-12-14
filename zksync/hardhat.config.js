const BaseConfig = require("../hardhat.base.config")
require("@matterlabs/hardhat-zksync-solc");

module.exports = Object.assign({},BaseConfig, {
  network: {
    "zksync": true,
  },
  paths: {
    sources: "../contracts",
    script: "../script"
  }
})

