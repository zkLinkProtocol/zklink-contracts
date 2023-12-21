require("@nomicfoundation/hardhat-ethers");
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");

const BaseConfig = require("../hardhat.base.config");

module.exports = Object.assign({}, BaseConfig, {
  zksolc: {
    version: "1.3.18",
    settings: {},
  },
  paths: {
    sources: "../contracts",
    script: "../script"
  }
})

