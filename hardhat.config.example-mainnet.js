require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-solpp");
require("@nomiclabs/hardhat-etherscan");
require("./script/deploy_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");

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

const allConfig = {
  ETH: ethConfig,
  BSC: bscConfig,
  AVAX: avaxConfig,
  POLYGON: polygonConfig,
}

const config = allConfig[process.env.NET];
if (config === undefined) {
  throw "NET env must be defined";
}

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
  defaultNetwork: "main",
  networks: {
    main: {
      url: config.url,
      accounts: [deployerKey]
    }
  },
  solpp:{
    defs: config.macro
  },
  etherscan: {
    apiKey: config.scan
  }
};
