# [ZkLink Contracts](https://zk.link/)

ZkLink is a cross chain protocol powered by ZK-Rollup. It currently supports evm based chain such as Ethereum, Binance Smart Chain, Heco Chain.

## Install Dependencies

`npm install`

## Prepare

Before compile contracts, you should generate `KeysWithPlonkVerifier.sol` and put it to `contracts/zksync` directory.You need to copy `hardhat.config.example.js` and rename it to `hardhat.config.js` and then to set api key and etherscan key.

## Compile Contracts

`npx hardhat compile`

or

`NET=ETH npx hardhat compile`

The `NET`  env variable determines which is the target chain for compiling contracts.

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
| UNITTEST    | For unit tests locally       |

## Run Tests

`NET=UNITTEST npx hardhat test`

## Deploy

Before deploy you should:

* Set the deploy key at `hardhat.config.js`
* Export `NET` to the target net
* Compile contracts

> Do not  use deploy address as network governor on the mainnet

### Deploy ZkLink

```shell
$ npx hardhat help deployZkLink

Hardhat version 2.9.3

Usage: hardhat [GLOBAL OPTIONS] deployZkLink --fee-account <STRING> --force <BOOLEAN> --genesis-root <STRING> --governor <STRING> --skip-verify <BOOLEAN> --validator <STRING>

OPTIONS:

  --fee-account         The feeAccount address, default is same as deployer 
  --force               Fore redeploy all contracts, default is false 
  --genesis-root        The genesis root hash 
  --governor            The governor address, default is same as deployer 
  --skip-verify         Skip verify, default is false 
  --validator           The validator address, default is same as deployer 

deployZkLink: Deploy zklink contracts
```

For example:

```shell
NET=ETH npx hardhat --network custom deployZkLink --governor GOVERNOR_ADDRESS --validator VALIDATOR_ADDRESS --feeAccount FEE_ACCOUNT_ADDRESS --genesis-root GENESIS_ROOT_HASH
```

### Deploy LayerZeroBridge

```bash
$ npx hardhat help deployLZBridge
Hardhat version 2.9.3

Usage: hardhat [GLOBAL OPTIONS] deployLZBridge --force <BOOLEAN> --governor <STRING> --skip-verify <BOOLEAN>

OPTIONS:

  --force       Fore redeploy all contracts, default is false 
  --governor    The governor address, default is same as deployer 
  --skip-verify Skip verify, default is false 

deployLZBridge: Deploy LayerZeroBridge
```

## Config LayerZero Bridge

After completing the deployment of zkLink and lzBridge on all chains,  we also need to config lzBridge of each chain:

* set bridge destinations
* set bridge app supported

### Set Bridge Destinations

```bash
$ npx hardhat help setDestinations
Hardhat version 2.9.3

Usage: hardhat [GLOBAL OPTIONS] setDestinations

setDestinations: Set layerzero bridge destinations on testnet
```

### Set supported app

```bash
$ npx hardhat help setDestinations
Hardhat version 2.9.3

Usage: hardhat [GLOBAL OPTIONS] setApp

setApp: Set layerzero supported app on testnet
```

