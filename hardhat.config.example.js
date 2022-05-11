require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/interact");

// main net
const ethConfig = {
  macro: {
    BLOCK_PERIOD: '15 seconds',
    CHAIN_ID: 1
  },
  url: "https://eth-mainnet.alchemyapi.io/v2/YOUK_API_KEY",
  scan: "YOUR_ETHERSCAN_KEY"
};

const bscConfig = {
  macro: {
    BLOCK_PERIOD: '3 seconds',
    CHAIN_ID: 2
  },
  url: "https://bsc-dataseed2.binance.org",
  scan: "YOUR_ETHERSCAN_KEY"
};

const avaxConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    CHAIN_ID: 3
  },
  url: "https://api.avax.network/ext/bc/C/rpc",
  scan: "YOUR_ETHERSCAN_KEY"
};

const polygonConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    CHAIN_ID: 4
  },
  url: "https://matic-mainnet.chainstacklabs.com",
  scan: "YOUR_ETHERSCAN_KEY"
};

// testnet
const polygonTestConfig = {
  macro: {
    BLOCK_PERIOD: polygonConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 1
  },
  url: "https://matic-mumbai.chainstacklabs.com",
  scan: polygonConfig.scan
};

const avaxTestConfig = {
  macro: {
    BLOCK_PERIOD: avaxConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 2
  },
  url: "https://api.avax-test.network/ext/bc/C/rpc",
  scan: avaxConfig.scan
};

const rinkebyConfig = {
  macro: {
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 3
  },
  url: "https://eth-rinkeby.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const goerliConfig = {
  macro: {
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 4
  },
  url: "https://eth-goerli.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const bscTestConfig = {
  macro: {
    BLOCK_PERIOD: bscConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 5
  },
  url: "https://data-seed-prebsc-1-s1.binance.org:8545",
  scan: bscConfig.scan
};

const allConfig = {
  ETH: ethConfig,
  BSC: bscConfig,
  AVAX: avaxConfig,
  POLYGON: polygonConfig,
  RINKEBY: rinkebyConfig,
  GOERLI: goerliConfig,
  BSCTEST: bscTestConfig,
  AVAXTEST: avaxTestConfig,
  POLYGONTEST: polygonTestConfig,
  UNITTEST: polygonTestConfig
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
