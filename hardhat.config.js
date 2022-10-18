require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-solpp");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");
require("./script/upgrade_lz_bridge");
require("./script/deploy_faucet");
require("./script/deploy_account_mock");
require("./script/interact");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers:[
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800
          }
        }
      },
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  },
  solpp:{
    defs: {
      BLOCK_PERIOD: '1 seconds',
      UPGRADE_NOTICE_PERIOD: 0,
      PRIORITY_EXPIRATION: 0,
      CHAIN_ID: 1,
      ENABLE_COMMIT_COMPRESSED_BLOCK: true,
      MIN_CHAIN_ID: 1,
      MAX_CHAIN_ID: 4,
      ALL_CHAINS: 15
    }
  },
  gasReporter: {
    enabled: !!(process.env.REPORT_GAS)
  }
};
