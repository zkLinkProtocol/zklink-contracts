require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");
const baseConfig = require("./hardhat.baseconfig");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const hardhatUserConfig = Object.assign({}, baseConfig, {
  zksolc: {
    version: "1.3.8",
    compilerSource: "binary",
    settings: {},
  },
});

module.exports = hardhatUserConfig;
