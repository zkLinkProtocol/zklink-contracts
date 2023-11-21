require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-solpp");
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_lz_bridge");
require("./script/deploy_faucet");
require("./script/deploy_account_mock");
require("./script/interact");
require("./script/deploy_l1_gateway");
require("./script/deploy_l2_gateway");
require("./script/deloy_multicall")
require("./script/upgrade_l2_gateway")
require("./script/upgrade_l1_gateway")

if (!process.env.NET.toUpperCase().includes('ZKSYNC')) {
  require("@openzeppelin/hardhat-upgrades");
}

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
      BLOCK_PERIOD: "1 seconds",
      UPGRADE_NOTICE_PERIOD: 0,
      PRIORITY_EXPIRATION: 0,
      CHAIN_ID: 1,
      ENABLE_COMMIT_COMPRESSED_BLOCK: true,
      MIN_CHAIN_ID: 1,
      MAX_CHAIN_ID: 4,
      ALL_CHAINS: 15,
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

  // import these packages if network is zksync
  if (netConfig.network.zksync !== undefined && netConfig.network.zksync) {
    require("@matterlabs/hardhat-zksync-solc");
    require("@matterlabs/hardhat-zksync-verify");

    hardhatUserConfig.zksolc = {
      version: "1.3.8",
      compilerSource: "binary",
      settings: {},
    };
  }
}

module.exports = hardhatUserConfig;
