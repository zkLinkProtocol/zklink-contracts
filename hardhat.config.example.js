require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");
require("./script/upgrade_lz_bridge");
require("./script/interact");

// main net
const ethConfig = {
  macro: {
    BLOCK_PERIOD: '15 seconds',
    CHAIN_ID: 1,
    ENABLE_COMMIT_COMPRESSED_BLOCK: true
  },
  url: "https://eth-mainnet.alchemyapi.io/v2/YOUK_API_KEY",
  scan: "YOUR_ETHERSCAN_KEY"
};

const bscConfig = {
  macro: {
    BLOCK_PERIOD: '3 seconds',
    CHAIN_ID: 2,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://bsc-dataseed2.binance.org",
  scan: "YOUR_ETHERSCAN_KEY"
};

const avaxConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    CHAIN_ID: 3,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://api.avax.network/ext/bc/C/rpc",
  scan: "YOUR_ETHERSCAN_KEY"
};

const polygonConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    CHAIN_ID: 4,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
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
    CHAIN_ID: 1,
    ENABLE_COMMIT_COMPRESSED_BLOCK: true
  },
  url: "https://matic-mumbai.chainstacklabs.com",
  scan: polygonConfig.scan
};

const avaxTestConfig = {
  macro: {
    BLOCK_PERIOD: avaxConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 2,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://api.avax-test.network/ext/bc/C/rpc",
  scan: avaxConfig.scan
};

const rinkebyConfig = {
  macro: {
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 3,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://eth-rinkeby.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const goerliConfig = {
  macro: {
    BLOCK_PERIOD: ethConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 4,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://eth-goerli.alchemyapi.io/v2/YOUK_API_KEY",
  scan: ethConfig.scan
};

const bscTestConfig = {
  macro: {
    BLOCK_PERIOD: bscConfig.macro.BLOCK_PERIOD,
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 5,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
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
config.macro.MIN_CHAIN_ID = 1;
config.macro.MAX_CHAIN_ID = 4;
config.macro.ALL_CHAINS = 15;

const deployerKey = "YOUR_DEPLOYER_KEY";

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
    },
    custom: {
      url: config.url,
      accounts: [deployerKey]
    }
  },
  solpp:{
    defs: config.macro
  },
  etherscan: {
    apiKey: config.scan
  },
  gasReporter: {
    enabled: !!(process.env.REPORT_GAS)
  }
};
