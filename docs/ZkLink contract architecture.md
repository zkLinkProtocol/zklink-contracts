# ZkLink contracts architecture

This document covers the structure of ZkLink Contracts.

## Core

ZkLink consists of two core modules：

* ZkLink：User deposit and withdraw in L1，blocks commit and verify from L2.
* Earn：Stake funds of ZkLink to get returns without security.

![image-20211128200745367](./contracts-structure.png)

### ZkLink

ZkLink module contains files in`contracts` and `contratcs/zksync`

* Deposit and withdraw
* Add liquidity, remove liquidity and swap
* Block commit, verify and execute
* Emergency exit

### Earn

Earn module contains files in `contracts/vault` and `contracts/strategy`

* Transfer funds to strategy
* Withdraw funds from strategy
* Manage strategies

### Fund FLows

* Deposit: User -> ZkLink -> Vault -> Strategy
* Withdraw: User <- ZkLink <- Vault <- Strategy
* Harvest: Strategy -> Stake Pool

## Stake

Stake consists of three modules:

* Stake pool: user stake or unstake nft produced by add liquidity
* ZkLinkNft: manage the life cycle of nft
* ZKL: token reward to liuqidity provider

### StakePool

StakePool module contains files in `contract/stake`

* Manage pools
* User stake and unstake nft
* Allocate rewards to staker users

### ZkLinkNft

ZkLinkNft module contains files in `contracts/nft`

* Mint new nft when user add liquidity to zklink
* Change status when layer2 msg executed at layer1

### ZKL

ZKL module contains files in `contract/token`

## Permissions

There are two permissions：

* Upgrade permission
* Business permission

All upgradeable contracts must be proxied by Proxy contract. Upgradeable contracts in ZkLink:

* Governance
* UniswapV2Factory
* Verifier
* Vault
* ZkSync

All Proxy contracts are managered by UpgradeGatekeeper，UpgradeGatekeeper can call upgradeTarget of these proxies。ZkSync is a little special，ZkSync  implement UpgradeableMaster，UpgradeableMaster is used as mainContract in UpgradeGatekeeper。

Contrats contain business permission are：

* UpgradeGatekeeper
* Governance
* UniswapV2Factory
* Vault
* ZkSync

| **Contract**          | **Business description**         | **Permission Owner** |
| --------------------- | -------------------------------- | -------------------- |
| **UpgradeGatekeeper** | Upgrade Proxy                    | governor             |
| **Governance**        | Token manage                     | governor             |
|                       | Validator manage                 | governor             |
| **UniswapV2Factory**  | Create pair                      | zkSync               |
|                       | Token mint and burn              | zkSync               |
| **Vault**             | Deposit record and withdraw      | zkSync               |
|                       | Strategy manage                  | governor             |
|                       | Fund manage                      | governor             |
| **ZkSync**            | Create pair                      | governor             |
|                       | Block commit, verify and execute | validator            |

governor will be a multiowner wallet or a timelock executor controlled by dao.
