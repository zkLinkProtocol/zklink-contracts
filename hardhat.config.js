require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-solpp");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");
require("./script/deploy_zklink");
require("./script/upgrade_zklink");
require("./script/deploy_zkl");
require("./script/deploy_lz_bridge");
require("./script/upgrade_lz_bridge");
require("./script/deploy_faucet");
require("./script/deploy_account_mock");
require("./script/interact");

const defaultNet = "DEFAULT";
// load config file by env 'NET'
const netName = process.env.NET === undefined ? defaultNet : process.env.NET;
const hardhatConfig = require(`./etc/${netName}.json`);

// custom network for example:
// {
//   url: "http://localhost:8545",
//   accounts: [deployerKey, governorKey]
// }
const defaultNetwork = netName === defaultNet ? "hardhat": "custom";

const networks = {
  hardhat: {
    allowUnlimitedContractSize: true,
  }
};
if (netName !== defaultNet) {
  networks.custom = hardhatConfig.network;
}

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
  defaultNetwork: defaultNetwork,
  networks: networks,
  solpp: {
    defs: hardhatConfig.macro
  },
  etherscan: {
    apiKey: hardhatConfig.scan
  },
  gasReporter: {
    enabled: !!(process.env.REPORT_GAS)
  }
};
