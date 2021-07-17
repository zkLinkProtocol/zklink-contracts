# [ZkLink Contracts](https://zk.link/)

ZkLink is a cross chain amm swap protocol powered by ZK-Rollup. It currently supports evm based chain such as Ethereum, Binance Smart Chain, Heco Chain.
You can swap token(eg. UNI) in Ethereum for token(eg. CAKE) in Binance Smart Chain smoothly, safely and with a very low cost.

## Install Dependencies

`npm install`

## Compile Contracts

`npx hardhat compile`

or set macro definitions

`MACRO=TEST npx hardhat compile`

## Run Tests

`npx hardhat test`

## Deploy

Before deploy you should complile contracts, and then set node environments for deploying to different blockchain.

| ENV Name      | Description                                              |
| ------------- | -------------------------------------------------------- |
| MACRO         | Macro definitions used to preprocess solidity            |
| NETWORK_URL   | Web3j url to connect to                                  |
| SCAN_API_KEY  | Blockchain explorer api key used to verify contract code |
| VAULT_ADDRESS | Used to deploy strategy after Vault contract deployed    |

We add a custom deploy task to hardhat environment

```shell
$ npx hardhat help deploy

Hardhat version 2.3.0

Usage: hardhat [GLOBAL OPTIONS] deploy --fee-account <STRING> --genesis-root <STRING> --governor <STRING> --key <STRING> --validator <STRING>

OPTIONS:

  --fee-account 	The feeAccount address
  --genesis-root	The genesis root hash
  --governor    	The governor address
  --key         	The deployer key
  --validator   	The validator address

deploy: Deploy zklink

For global options help run: hardhat help
```

### Deploy to Ethereum mainnet

```shell
MACRO=ETH NETWORK_URL=https://eth-mainnet.alchemyapi.io/v2/YOUK_API_KEY SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

### Deploy to Binance smart chain mainnet

```shell
MACRO=BSC NETWORK_URL=https://bsc-dataseed2.binance.org SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

### Deploy to Heco chain mainnet

```shell
MACRO=HECO NETWORK_URL=https://http-mainnet.hecochain.com SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

### Deploy to Binance smart chain testnet

```shell
MACRO=TEST NETWORK_URL=https://data-seed-prebsc-1-s1.binance.org:8545 SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --genesis-root GENESIS_ROOT_HASH
```
