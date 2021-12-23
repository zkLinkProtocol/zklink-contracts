# [ZkLink Contracts](https://zk.link/)

ZkLink is a cross chain amm swap protocol powered by ZK-Rollup. It currently supports evm based chain such as Ethereum, Binance Smart Chain, Heco Chain.
You can swap token(eg. UNI) in Ethereum for token(eg. CAKE) in Binance Smart Chain smoothly, safely and with a very low cost.

## Install Dependencies

`npm install`

## Prepare

Before compile contracts, you should generate `KeysWithPlonkVerifier.sol` and put it to `contracts/zksync` directory.You need to copy `hardhat.config.example.js` and rename it to `hardhat.config.js` and then to set api key and etherscan key.

## Compile Contracts

`npx hardhat compile`

or

`NET=ETH npx hardhat compile`

## Run Tests

`NET=UNITTEST npx hardhat test`

## Deploy

Before deploy you should:

* Compile contracts
* Set deploy address key to `.KEY` file at `scripts` directory
* Set `NET` environment for deploying to different blockchain

| NET Name    | Description                  |
| ----------- | ---------------------------- |
| ETH         | Ethereum main net            |
| BSC         | Binance smart chain main net |
| AVAX        | Avalanch chain main net      |
| POLYGON     | Polygon main net             |
| RINKEBY     | Ethereum rinkeby testnet     |
| GOERLI      | Ethereum goerli testnet      |
| BSCTEST     | Binance smart chain testnet  |
| AVAXTEST    | Avalanch chain testnet       |
| POLYGONTEST | Polygon testnet              |

We add a custom deploy task to hardhat environment

```shell
$ npx hardhat help deployZkLink

Hardhat version 2.6.1

Usage: hardhat [GLOBAL OPTIONS] deployZkLink --fee-account <STRING> --force <BOOLEAN> --genesis-root <STRING> --governor <STRING> --skip-verify <BOOLEAN> --validator <STRING>

OPTIONS:

  --fee-account 	The feeAccount address, default is same as deployer
  --force       	Fore redeploy all contracts, default is false
  --genesis-root	The genesis root hash
  --governor    	The governor address, default is same as deployer
  --skip-verify 	Skip verify, default is false
  --validator   	The validator address, default is same as deployer

deploy: Deploy zklink contracts

For global options help run: hardhat help
```

For example:

```shell
NET=ETH npx hardhat --network custom deployZkLink --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```
