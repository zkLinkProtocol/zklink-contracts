## Owner

The Owner controls contract upgrades. The upgradable contracts include:

- ZkLink
- ZkLinkPeriphery
- Verifier

The Owner of these upgradable contracts is the `UpgradeGatekeeper` contract. The Owner of the `UpgradeGatekeeper` can be set to a multi-signature contract.

## NetworkGovernor

The NetworkGovernor has management permissions other than contract upgrades, including:

- Can call interfaces like `addToken` and `setTokenPaused` to register and manage token information.
- Can add and manage Validators through the `setValidator` function.
- Can replace the NetworkGovernor via the `changeGovernor` function.
- Can add and manage cross-chain bridges through the `setSyncService` function.
- Can set various configuration information for cross-chain bridges.

## Validator

Validators are set by the NetworkGovernor, and multiple Validators can be set. Validators have the authority to call the `commitBlocks`, `proveBlocks`, `revertBlocks`, and `executeBlocks` interfaces of the ZkLink contract to manage the lifecycle of Blocks.