// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

abstract contract ZkSyncMessageConfig {
    uint8 internal constant MESSAGE_WITHDRAW_ETH = 1;
    uint8 internal constant MESSAGE_WITHDRAW_ERC20 = 2;
    uint8 internal constant MESSAGE_SEND_SLAVER_SYNC_HASH = 3;
    uint8 internal constant MESSAGE_SEND_MASTER_SYNC_HASH = 4;
}
