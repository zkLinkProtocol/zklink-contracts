# [ZkLink Contracts](https://zk.link/)

ZkLink is a cross chain protocol powered by ZK-Rollup. It currently supports evm based chain such as Ethereum, Binance Smart Chain, Heco Chain.

## Install Dependencies

`npm install`

## Prepare for compile

Before compile contracts, you should generate `KeysWithPlonkVerifier.sol` and put it to `contracts/zksync` directory. For local development, you could copy and rename the `KeysWithPlonkVerifier.example` at the root path.

```shell
cp KeysWithPlonkVerifier.example contracts/zksync/KeysWithPlonkVerifier.sol
```

## Compile contracts

`npx hardhat compile`

## Run tests

Run all unit tests:

`npx hardhat test`

Run a unit test:

```shell
npx hardhat test test/bytes_test.js
```

## Deploy
* [Firstly deploy](docs/Deploy.md)
* [Upgrade](docs/Upgrade.md)
* [Interact with zkLink](docs/Interact.md)


## Development

For developers, static analysis need to be done before committing code. Read more of [SecurityCheck](docs/SecurityCheck.md).
