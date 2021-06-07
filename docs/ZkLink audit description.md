ZkLink contracts is forked from [ZkSync(tag: contracts-4.3)](https://github.com/matter-labs/zksync/tree/contracts-4.3/contracts/contracts), which is audited by [ABDK Consulting](https://zksync.io/updates/security-audits.html). Zklink add two features: swap and vault.

## Unmodified contracts

Same contracts have not been modified compared to contracts-4.3.

* Bytes.sol
* Governance.sol
* IERC20.sol
* KeysWithPlonkVerifier.sol
* Owanable.sol
* PlonkCore.sol
* Proxy.sol
* ReentrancyGuard.sol
* SafeCast.sol
* SafeMath.sol
* SafeMathUInt128.sol
* TokenInit.sol
* Upgradeable.sol
* UpgradeableMaster.sol
* UpgradeGatekeeper.sol
* Utils.sol
* Verifier.sol

Governance.sol is slightly modified by adding zero address check when change governor.

## Remove deprecated code

Contracts-4.3 is a upgrade version and it has some deprecated state(which is with _DEPRECATED as suffix) and function(which is commented with DEPRECATED).

States removed from Storage.sol are:

* pendingWithdrawals_DEPRECATED
* firstPendingWithdrawalIndex_DEPRECATED
* numberOfPendingWithdrawals_DEPRECATED
* blocks_DEPRECATED
* priorityRequests_DEPRECATED

Functions removed from ZkSync.sol are:

* getBalanceToWithdraw
* withdrawERC20
* withdrawETH
* fullExit

`update` logis in ZkSync.sol is cleared beacuse ZkLink has no need to upgrade here. `deleteRequests` internal method is  removed beacuse no any other method call it.

## Split ZkSync

ZkSync.sol code size will exceeds [limit](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-170.md) in ethereum after add new features of ZkLink. We split ZkSync.sol to two parts: ZkSync.sol and ZkSyncBlock.sol. ZkSync.sol contains functions like user deposit and withdraw and ZkSyncBlock.sol contains functions like block commit, prove and execute.

* Add a new address`zkSyncBlock` in storage, which is the delegate call target address in ZkSync.sol
* Add `fallback` function in ZkSync.sol to deletecall functions like commitBlocks to ZkSyncBlock.sol

## Swap

ZkLink swap is base on uniswap v2, new pair is created in L1 as normal but can only be trade in L2. ZkSync support token amount is 128, ZkLink support token amount is 2048, the first 128 tokens are same as ZkSync and the left are LP tokens.

| token id | total | description |
| -------- | ----- | ----------- |
| 0        | 1     | ETH         |
| 1-127    | 127   | ERC20 token |
| 128-2047 | 1920  | LP token    |

### CreatePair

Only governor can create pair of two different erc20 tokens or pair of eth and erc20 token. CreatePair Operation is a priority operation(like Deposit)  but not processable(like PartialExit) and must be checked when block committed.

### Deposit and withdraw

LP tokens deposit and withdraw are nearly the same as normal erc20 tokens. The difference is when user deposit LP token to L1  these tokens will be burned and when user withdraw from L2 tokens will be minted to user.

### Changes

* Operations.sol

  Add four new Operations: CreatePair, AddLiquidity, RemoveLiquidity and Swap. CreatePair is a priority operation with serializtion and unserialization method.

* Config.sol

  Add  CREATE_PAIR_BYTES,  ADD_RM_LIQ_BYTES, SWAP_BYTES. AddLiquidity and RemoveLiquidity operation has the same size.

* Events.sol

  Add CreatePair event

* Storage.sol

  Add a new state `pairManager` which used by ZkSync to create LP token, mint and burn LP token.

* ZkSync.sol

  Add createPair, createETHPair, update depositERC20 and withdrawPendingBalance to satisfy  LP token.

* ZkSyncBlock.sol

  Add CreatePair operation check,  jump AddLiquidity, RemoveLiquidity and swap check.

Add uniswap directory and PairTokenManager.sol(which are copied from [ZkSwap contract](https://github.com/l2labs/zkswap-contracts/tree/main/contracts)), uniswap directory contains uniswap v2 codes, PairTokenManager is used to manage LP token like Governance.

## Vault

Vault is used to hold assets in L1 and take strategies to earn more. When deposit ETH or normal erc20 tokens to L1, these assets will be migrated to Vault immediately. When withdraw assets from L1, firstly check balance of Vault, if not enough then withdraw from strategy. Vault withdraw asset from strategy may produce loss especially when withdraw amount is very huge. 

**Withdraw** in ZkLink is a big difference from ZkSync, user must set lossBip when withdraw, which means the max loss percent they can accept. Validator cannot help user to withdraw assets derictly by process priority requests any more.

Debt means the amount of assets users deposited to L1,  vault must reserve some assets to satisfy user withdraws, each token has its reserveRatio. After transfer asset to strategy the left balance of vault must not less than reserveRatio * debt.

Strategy can only be mangered by network governor and must wait 7 days to take effective whether it's a new addition or an upgrade.

### Changes

* Storage.sol

  Add a new state vault address to hold assets deposited to L1.

* ZkSync.sol

  Update depositETH, depositERC20 to record debt produced by user deposit. Add lossBip param in withdrawPendingBalance and delegate withdraw to vault if withdraw token is not LP token. Add depositETHFromVault and depositERC20FromVault (which can only be called by vault) to help settle reward.

* ZkSyncBlock.sol

  Rename withdrawOrStore to store, remove code about withdraw to user and only store balance increase. Remove sendETHNoRevert function which is not used any more.

Add Vault.sol, VaultStorage.sol, IStrategy.sol.













