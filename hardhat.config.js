require("@nomiclabs/hardhat-waffle");
require("adhusson-hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require("./deploy");
require("./interact");

const ethConfig = {
  MAX_AMOUNT_OF_REGISTERED_TOKENS: 127,
  BLOCK_PERIOD: '15 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  CHAIN_ID: 0
};

const bscConfig = {
  MAX_AMOUNT_OF_REGISTERED_TOKENS: 127,
  BLOCK_PERIOD: '3 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  CHAIN_ID: 1
};

const hecoConfig = {
  MAX_AMOUNT_OF_REGISTERED_TOKENS: 127,
  BLOCK_PERIOD: '3 seconds',
  // UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '7 days',
  CHAIN_ID: 2
};

const testConfig = {
  MAX_AMOUNT_OF_REGISTERED_TOKENS: 127,
  BLOCK_PERIOD: '3 seconds',
  UPGRADE_NOTICE_PERIOD: 0,
  STRATEGY_ACTIVE_WAIT: '0 days',
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
        version: "0.8.0",
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

