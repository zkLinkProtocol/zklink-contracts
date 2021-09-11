require("@nomiclabs/hardhat-waffle");
require("adhusson-hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require("./deploy");
require("./interact");

const MAX_TOKEN_NUM = 127;

// main net
const ethConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: MAX_TOKEN_NUM,
    BLOCK_PERIOD: '15 seconds',
    // UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '7 days',
    CHAIN_ID: 0
  },
  url: "https://eth-mainnet.alchemyapi.io/v2/YOUK_API_KEY",
  scan: "YOUR_ETHERSCAN_KEY"
};

const bscConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: MAX_TOKEN_NUM,
    BLOCK_PERIOD: '3 seconds',
    // UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '7 days',
    CHAIN_ID: 1
  },
  url: "https://bsc-dataseed2.binance.org",
  scan: "YOUR_ETHERSCAN_KEY"
};

const hecoConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: MAX_TOKEN_NUM,
    BLOCK_PERIOD: '3 seconds',
    // UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '7 days',
    CHAIN_ID: 2
  },
  url: "https://http-mainnet.hecochain.com",
  scan: "YOUR_ETHERSCAN_KEY"
};

const polygonConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: MAX_TOKEN_NUM,
    BLOCK_PERIOD: '2 seconds',
    // UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '7 days',
    CHAIN_ID: 0
  },
  url: "https://matic-mainnet.chainstacklabs.com",
  scan: "YOUR_ETHERSCAN_KEY"
};

// testnet
const rinkebyConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: ethConfig.macro.MAX_AMOUNT_OF_REGISTERED_TOKENS,
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '0 days',
    CHAIN_ID: 1
  },
  url: "https://eth-rinkeby.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const goerliConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: ethConfig.macro.MAX_AMOUNT_OF_REGISTERED_TOKENS,
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '0 days',
    CHAIN_ID: 3
  },
  url: "https://eth-goerli.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const bscTestConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: bscConfig.macro.MAX_AMOUNT_OF_REGISTERED_TOKENS,
    BLOCK_PERIOD: bscConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '0 days',
    CHAIN_ID: 4
  },
  url: "https://data-seed-prebsc-1-s1.binance.org:8545",
  scan: bscConfig.scan
};

const hecoTestConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: hecoConfig.macro.MAX_AMOUNT_OF_REGISTERED_TOKENS,
    BLOCK_PERIOD: hecoConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '0 days',
    CHAIN_ID: 2
  },
  url: "https://http-testnet.hecochain.com",
  scan: hecoConfig.scan
};

const polygonTestConfig = {
  macro: {
    MAX_AMOUNT_OF_REGISTERED_TOKENS: polygonConfig.macro.MAX_AMOUNT_OF_REGISTERED_TOKENS,
    BLOCK_PERIOD: polygonConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    STRATEGY_ACTIVE_WAIT: '0 days',
    CHAIN_ID: 0
  },
  url: "https://matic-mumbai.chainstacklabs.com",
  scan: polygonConfig.scan
};

const allConfig = {
  ETH: ethConfig,
  BSC: bscConfig,
  HECO: hecoConfig,
  POLYGON: polygonConfig,
  RINKEBY: rinkebyConfig,
  GOERLI: goerliConfig,
  BSCTEST: bscTestConfig,
  HECOTEST: hecoTestConfig,
  POLYGONTEST: polygonTestConfig
}

const config = process.env.NET === undefined ? allConfig["ETH"] : allConfig[process.env.NET];

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
      url: config.url
    }
  },
  solpp:{
    defs: config.macro
  },
  etherscan: {
    apiKey: config.scan
  }
};

