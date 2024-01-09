require("@nomiclabs/hardhat-solpp");

require("./script/deploy_zklink");
require("./script/deploy_lz_bridge");
require("./script/deploy_faucet");
require("./script/deploy_account_mock");
require("./script/interact");
require("./script/deploy_l1_gateway");
require("./script/deploy_l2_gateway");
require("./script/deploy_arbitrator");
require("./script/deloy_multicall");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const hardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  solpp: {
    defs: {
      DEFAULT_FEE_ADDRESS: "0x199AaA230f18432a715528B4091120cdCc7D9779",
      BLOCK_PERIOD: "1 seconds",
      UPGRADE_NOTICE_PERIOD: 0,
      PRIORITY_EXPIRATION: 0,
      CHAIN_ID: 1,
      MAX_CHAIN_ID: 4,
      ALL_CHAINS: 15,
      MASTER_CHAIN_ID: 1,
      SYNC_TYPE: 0
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
  },
  mocha: {
    timeout: 600000,
  },
};

// custom hardhat user config for different net
if (process.env.NET !== undefined) {
  const netName = process.env.NET;
  hardhatUserConfig.defaultNetwork = netName;

  const netConfig = require(`./etc/${netName}.json`);
  hardhatUserConfig.networks[netName] = netConfig.network;

  if (netConfig.macro !== undefined) {
    hardhatUserConfig.solpp.defs = netConfig.macro;
  }

  // config contract verify key if exist
  if (netConfig.etherscan !== undefined) {
    hardhatUserConfig.etherscan = netConfig.etherscan;
  }
} else if (process.env.MASTER === "true") {
  hardhatUserConfig.solpp.defs.CHAIN_ID = 1;
  hardhatUserConfig.solpp.defs.MAX_CHAIN_ID = 4;
  hardhatUserConfig.solpp.defs.ALL_CHAINS = 11; // [1,3,4]
  hardhatUserConfig.solpp.defs.MASTER_CHAIN_ID = 1;
} else if (process.env.MASTER === "false") {
  hardhatUserConfig.solpp.defs.CHAIN_ID = 2;
  hardhatUserConfig.solpp.defs.MAX_CHAIN_ID = 4;
  hardhatUserConfig.solpp.defs.ALL_CHAINS = 11; // [1,3,4]
  hardhatUserConfig.solpp.defs.MASTER_CHAIN_ID = 1;
}
if (process.env.SYNC_TYPE !== undefined) {
  hardhatUserConfig.solpp.defs.SYNC_TYPE = process.env.SYNC_TYPE;
}

hardhatUserConfig.isMasterChain =
  hardhatUserConfig.solpp.defs.CHAIN_ID ===
  hardhatUserConfig.solpp.defs.MASTER_CHAIN_ID;

hardhatUserConfig.syncType = hardhatUserConfig.solpp.defs.SYNC_TYPE;

module.exports = hardhatUserConfig;
