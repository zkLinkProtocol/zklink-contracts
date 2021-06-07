# ZkLink contracts architecture

This document covers the structure of ZkLink Contracts.

## Core Modules

ZkLink consists of two core modules：

* ZkSync：User deposit and withdraw in L1，blocks commit and verify from L2.
* Earn：Use part of  funds in ZkSync to invest and get high returns.

![image-20210525193838814](./contracts-structure.png)

### ZkSync

* User deposit and withdraw
* Create pair
* Block commit, verify and execute
* Emergency exit

### Earn

* Transfer part of funds to strategy
* Withdraw funds from strategy
* Transfer profit to user reward address and protocol reward address

### Fund FLows

* Deposit: User -> ZkSync -> Vault
* Invest: Vault -> Strategy
* Withdraw: User <- ZkSync <- Vault <- Strategy
* Settle reward: Vault -> reward address

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

governorwill be a multiowner wallet or a timelock executor controlled by dao.
