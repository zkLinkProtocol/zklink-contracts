require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-solpp");
require('@openzeppelin/hardhat-upgrades');
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");
require("./script/upgrade_lz_bridge");
require("./script/deploy_faucet");
require("./script/interact");

const local1Config = {
  macro: {
    BLOCK_PERIOD: '1 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 1,
    ENABLE_COMMIT_COMPRESSED_BLOCK: true
  },
  chainId: 10001,
  url: "http://localhost:8545",
};

const local2Config = {
  macro: {
    BLOCK_PERIOD: '1 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 2,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  chainId: 10002,
  url: "http://localhost:8546",
};

const local3Config = {
  macro: {
    BLOCK_PERIOD: '1 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 3,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  chainId: 10003,
  url: "http://localhost:8547",
};

const local4Config = {
  macro: {
    BLOCK_PERIOD: '1 seconds',
    UPGRADE_NOTICE_PERIOD: 0,
    PRIORITY_EXPIRATION: 0,
    CHAIN_ID: 4,
    ENABLE_COMMIT_COMPRESSED_BLOCK: false
  },
  chainId: 10004,
  url: "http://localhost:8548",
};

const allConfig = {
  LOCAL1: local1Config,
  LOCAL2: local2Config,
  LOCAL3: local3Config,
  LOCAL4: local4Config,
}

const config = allConfig[process.env.NET];
if (config === undefined) {
  throw "NET env must be defined";
}

config.macro.MIN_CHAIN_ID = 1;
config.macro.MAX_CHAIN_ID = 4;
config.macro.ALL_CHAINS = 15;

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
  defaultNetwork: "local",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: config.chainId,
    },
    local: {
      url: config.url,
    }
  },
  solpp:{
    defs: config.macro
  }
};
