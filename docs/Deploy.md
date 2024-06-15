## Config deployment
The example configuration file path is `etc/EXAMPLE.json`

```json
{
  "network": {
    "url": "https://matic-mumbai.chainstacklabs.com",
    "accounts": ["YOUR_DEPLOYER_KEY"]
  },
  "etherscan": {
    "apiKey": "YOUR_ETHERSCAN_KEY"
  },
  "macro":{
    "DEFAULT_FEE_ADDRESS": "0x199AaA230f18432a715528B4091120cdCc7D9779",
    "BLOCK_PERIOD": "1 seconds",
    "UPGRADE_NOTICE_PERIOD": 0,
    "PRIORITY_EXPIRATION": 0,
    "CHAIN_ID": 1,
    "MAX_CHAIN_ID": 4,
    "ALL_CHAINS": 15,
    "MASTER_CHAIN_ID": 1,
    "SYNC_TYPE": 0
  }
}
```

`macro` is an object and define some macro variables consumed by  `@nomiclabs/hardhat-solpp` (a solidity preprocessor) to generate solidity code.

* `DEFAULT_FEE_ADDRESS` is the default fee address when init zkLink state tree.

* `CHAIN_ID` is the id defined in zkLink network(not the blockchain id). You need to set the `CHAIN_ID` according to the actual deployment situation.

* `MASTER_CHAIN_ID` is the chain to submit complete blocks.

* `BLOCK_PERIOD` is average the block generation time, for example, in ethereum mainnet it's value is `12 seconds`.

* `UPGRADE_NOTICE_PERIOD`  is the contract upgrade lock time, when deploy in local development you could set this value to zero, and then we can upgrade contract immediately.

* `PRIORITY_EXPIRATION` is how long we wait for priority operation to handle by zklink.

* `SYNC_TYPE` is crosschain message sync type.

`macro` also has two variables about constraints on `CHAIN_ID`:

* MAX_CHAIN_ID, the max chain id of zkLink network.
* ALL_CHAINS, the  supported chain ids flag.

You should set `MAX_CHAIN_ID` and `ALL_CHAINS` according to the actual deployment situation. For example, the initial deployment we support two chains: 1 and 2, so `MAX_CHAIN_ID` should be  2 and `ALL_CHAINS` should be 3(`1 << 0 | 1 << 2`). The second deployment we support another chain: 3, and `MAX_CHAIN_ID` should be updated to  3 and `ALL_CHAINS` should be updated to 7(`1 << 0 | 1 << 1 | 1 << 2`).

Network `url` is the blockchain rpc url that hardhat connected to. 

`YOUR_DEPLOYER_KEY` is the private key of deployer when deploying contracts. 

`apiKey` is the key used by `@nomiclabs/hardhat-etherscan` to verify contract code deployed to `etherscan` explorer.

The `NET` env variable determines the chain configuration used for deploy commands. Before deploy you should create a config file with the example config file:

```shell
cd etc
cp -f EXAMPLE.json POLYGONTEST.json
```

And  `export NET=POLYGONTEST`  before `npx hardhat deployZkLink`  or

```shell
NET=POLYGONTEST npx hardhat [global options] deployZkLink [command options]
```

## Deploy command
### Deploy ZkLink

```shell
$ npx hardhat help deployZkLink

Hardhat version 2.13.1

Usage: hardhat [GLOBAL OPTIONS] deployZkLink [--block-number <INT>] [--force <BOOLEAN>] [--genesis-root <STRING>] [--skip-verify <BOOLEAN>] [--validator <STRING>]

OPTIONS:

  --block-number        The block number (default: 0)
  --force               Fore redeploy all contracts (default: false)
  --genesis-root        The block root hash (default: "0x0000000000000000000000000000000000000000000000000000000000000000")
  --skip-verify         Skip verify (default: false)
  --validator           The validator address (default is same as deployer) 

deployZkLink: Deploy zklink contracts
```

`--block-number`,`--genesis-root`,`--timestamp` are used to produce genesie block. When deploying for the first time `--block-number` and `--timestamp` can be left unset. When deploying for appending a new chain all these options need to be set with the latest exectuted block properties.

You could left `--validator`  be unset when deploy to devnet or testnet, but **DOT NOT**  use deployer address as network validator on the mainnet.

After the deployment is complete, a log file with a name of `deploy_${NET}.log` will be generated in the `log` directory of the project root path. 

```json
{
  "deployer":"0x199AaA230f18432a715528B4091120cdCc7D9779",
  "governor":"0x199AaA230f18432a715528B4091120cdCc7D9779",
  "validator":"0x199AaA230f18432a715528B4091120cdCc7D9779",
  "verifierTarget":"0x552Aefb91D326488785DDa84F884E174d7dcBBB2",
  "verifierTargetVerified":true,
  "verifierProxy":"0x4B47371D344aB76E89f8061E9935Ec7CB4af3BE0",
  "verifierProxyVerified":true,
  "peripheryTarget":"0xbFe6da8e43F59E4eB28fA46D26e0b999b55c2C3C",
  "peripheryTargetVerified":true,
  "zkLinkTarget":"0x78F248ad01D27bFD41EB55A6B1e2A3C31b702fe4",
  "zkLinkTargetVerified":true,
  "zkLinkProxy":"0x631cA5b106Bdd32E9EA47cC6f3350c925988Dee4",
  "deployTxHash":"0x7dcfefb2a158d4da60fdbc3a1bab30a8dedd211d8a8e37997ea709e0d049a32a",
  "deployBlockNumber":2654062,
  "zkLinkProxyVerified":true,
  "gatekeeper":"0x7CcBA85c2865Db4919c073bF7524aeD26d7Ba8e7",
  "gatekeeperVerified":true,
  "verifierTransferMastership":true,
  "zkLinkTransferMastership":true,
  "verifierAddUpgrade":true,
  "zkLinkSetValidator":true
}
```

The `zkLinkProxy`  is the address we used to interact with zkLink contract, such as: `depositETH`, `addToken` ,`setSyncService`.

If there is a network error occurs during the execution of the command, you can execute it again and the command will start from place where it failed last time.

For example:

```shell
NET=ETH npx hardhat deployZkLink --validator VALIDATOR_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

### Deploy LayerZeroBridge

```bash
$ npx hardhat help deployLZBridge
Hardhat version 2.13.1

Usage: hardhat [GLOBAL OPTIONS] deployLZBridge [--force <BOOLEAN>] [--skip-verify <BOOLEAN>] [--zklink <STRING>]

OPTIONS:

  --force       Fore redeploy all contracts (default: false)
  --skip-verify Skip verify (default: false)
  --zklink      The zklink address (default get from zkLink deploy log) 

deployLZBridge: Deploy LayerZeroBridge
```

LayerZeroBridge is used to bridge cross chain verify message between different chains.This command is only available in mainnet and testnet.

After the deployment is complete, a log file with a name of `deploy_lz_bridge_${NET}.log` will be generated in the `log` directory of the project root path. 

```json
{
  "deployer": "0x199AaA230f18432a715528B4091120cdCc7D9779",
  "lzBridge": "0xc68D03B92Cb6ECE124f2F41178DeCa0271FE7981",
  "lzBridgeVerified": true
}
```

The `lzBridge` is the address that used to `setSyncService` .

For example:

```shell
NET=ETH npx hardhat deployLZBridge
```
