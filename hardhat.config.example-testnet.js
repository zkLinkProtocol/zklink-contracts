require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");
require("./script/upgrade_lz_bridge");
require("./script/deploy_faucet");
require("./script/interact");

const polygonTestConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 1,
    ENABLE_COMMIT_COMPRESSED_BLOCK: true
  },
  url: "https://matic-mumbai.chainstacklabs.com",
  scan: "YOUR_ETHERSCAN_KEY"
};

const avaxTestConfig = {
  macro: {
    BLOCK_PERIOD: '2 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 2,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://api.avax-test.network/ext/bc/C/rpc",
  scan: "YOUR_ETHERSCAN_KEY"
};

const rinkebyConfig = {
  macro: {
    BLOCK_PERIOD: '15 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 3,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://eth-rinkeby.alchemyapi.io/v2/YOUK_API_KEY",
  scan: "YOUR_ETHERSCAN_KEY"
};

const goerliConfig = {
  macro: {
    BLOCK_PERIOD: '15 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 4,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://eth-goerli.alchemyapi.io/v2/YOUK_API_KEY",
  scan: "YOUR_ETHERSCAN_KEY"
};

const bscTestConfig = {
  macro: {
    BLOCK_PERIOD: '3 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 5,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  url: "https://data-seed-prebsc-1-s1.binance.org:8545",
  scan: "YOUR_ETHERSCAN_KEY"
};

const allConfig = {
  RINKEBY: rinkebyConfig,
  GOERLI: goerliConfig,
  BSCTEST: bscTestConfig,
  AVAXTEST: avaxTestConfig,
  POLYGONTEST: polygonTestConfig
}

const config = allConfig[process.env.NET];
if (config === undefined) {
  throw "NET env must be defined";
}

config.macro.MIN_CHAIN_ID = 1;
config.macro.MAX_CHAIN_ID = 4;
config.macro.ALL_CHAINS = 15;

const deployerKey = "YOUR_DEPLOYER_KEY";
const governorKey = "YOUR_GOVERNOR_KEY";

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
  defaultNetwork: "test",
  networks: {
    test: {
      url: config.url,
      accounts: [deployerKey, governorKey]
    }
  },
  solpp:{
    defs: config.macro
  },
  etherscan: {
    apiKey: config.scan
  }
};
