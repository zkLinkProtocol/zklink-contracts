ZkLink contracts is forked from [ZkSync(tag: contracts-4.3)](https://github.com/matter-labs/zksync/tree/contracts-4.3/contracts/contracts), which is audited by [ABDK Consulting](https://zksync.io/updates/security-audits.html). Zklink add more features: swap ,bridge, vault and stake.

## Unmodified contracts of zksync

Same contracts in `contracts/zksync` have not been modified compared to contracts-4.3.

* Bytes.sol
* IERC20.sol
* KeysWithPlonkVerifier.sol
* Owanable.sol
* PlonkCore.sol
* Proxy.sol
* ReentrancyGuard.sol
* SafeCast.sol
* SafeMath.sol
* SafeMathUInt128.sol
* Upgradeable.sol
* UpgradeableMaster.sol
* UpgradeGatekeeper.sol
* Utils.sol
* Verifier.sol

`Config.sol`, `Events.sol`,  is slightly modified by some constant and event definitions.

## Unmodified contracts of opeasea

`Erc721Tradeable.sol` and files in `common/meta-transactions` are copied from [opensea-creatures](https://github.com/ProjectOpenSea/opensea-creatures)













