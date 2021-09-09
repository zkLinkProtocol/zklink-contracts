# [ZkLink Contracts](https://zk.link/)

ZkLink is a cross chain amm swap protocol powered by ZK-Rollup. It currently supports evm based chain such as Ethereum, Binance Smart Chain, Heco Chain.
You can swap token(eg. UNI) in Ethereum for token(eg. CAKE) in Binance Smart Chain smoothly, safely and with a very low cost.

## Install Dependencies

`npm install`

## Compile Contracts

Before compile contracts, you should generate `KeysWithPlonkVerifier.sol` and put it to contracts directory

`npx hardhat compile`

or set macro definitions

`MACRO=TEST npx hardhat compile`

## Run Tests

`npx hardhat test`

## Deploy ZkLink

Before deploy you should complile contracts, and then set node environments for deploying to different blockchain.

| ENV Name     | Description                                              |
| ------------ | -------------------------------------------------------- |
| MACRO        | Macro definitions used to preprocess solidity            |
| NETWORK_URL  | Web3j url to connect to                                  |
| SCAN_API_KEY | Blockchain explorer api key used to verify contract code |

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

###Mainnet

####ETH

```shell
MACRO=ETH NETWORK_URL=https://eth-mainnet.alchemyapi.io/v2/YOUK_API_KEY SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

####BSC

```shell
MACRO=BSC NETWORK_URL=https://bsc-dataseed2.binance.org SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

####HECO

```shell
MACRO=HECO NETWORK_URL=https://http-mainnet.hecochain.com SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

###Testnet

####BSC

```shell
MACRO=TEST NETWORK_URL=https://data-seed-prebsc-1-s1.binance.org:8545 SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --genesis-root GENESIS_ROOT_HASH
```

#### Polygon

```shell
MACRO=TEST NETWORK_URL=https://matic-mumbai.chainstacklabs.com SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy --key DEPLOYER_ADDRESS_PRIVATE_KEY --genesis-root GENESIS_ROOT_HASH
```

###Deploy Strategy

```shell
VAULT_ADDRESS=DEPLOYED_VAULT_ADDRESS NETWORK_URL=WEB3J_URL SCAN_API_KEY=YOUR_ETHERSCAN_KEY npx hardhat --network custom deploy_strategy --key DEPLOYER_ADDRESS_PRIVATE_KEY --strategy BscCoinwindStrategy --params '0 3'
```
