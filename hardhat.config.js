require("@nomiclabs/hardhat-waffle");
require("adhusson-hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require("./deploy");
require("./interact");

const vaultAddress = process.env.VAULT_ADDRESS === undefined ? 'address(0)' : process.env.VAULT_ADDRESS;

const ethConfig = {
  BLOCK_PERIOD: '15 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  VAULT_ADDRESS: vaultAddress,
  CHAIN_ID: 0
};

const bscConfig = {
  BLOCK_PERIOD: '3 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  VAULT_ADDRESS: vaultAddress,
  CHAIN_ID: 1
};

const hecoConfig = {
  BLOCK_PERIOD: '3 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  VAULT_ADDRESS: vaultAddress,
  CHAIN_ID: 2
};

const testConfig = {
  BLOCK_PERIOD: '3 seconds',
  UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '0 days',
  VAULT_ADDRESS: vaultAddress,
  CHAIN_ID: 0
};

const macroConfig = {
  ETH: ethConfig,
  BSC: bscConfig,
  HECO: hecoConfig, // heco block period is same with bsc
  TEST: testConfig
}

const macroDefs = process.env.MACRO === undefined ? macroConfig["ETH"] : macroConfig[process.env.MACRO];

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
            runs: 200
          }
        }
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
  },
  networks: {
    hardhat: {
    },
    custom: {
      url: process.env.NETWORK_URL === undefined ? '' : process.env.NETWORK_URL
    }
  },
  solpp:{
    defs: macroDefs
  },
  etherscan: {
    apiKey: process.env.SCAN_API_KEY === undefined ? '' : process.env.SCAN_API_KEY
  }
};

