// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkSync.sol";

contract ZkSyncUser {

    ZkSync public zkSync;

    constructor(address payable _zkSync) {
        zkSync = ZkSync(_zkSync);
    }

    receive() external payable {}

    function withdrawETH(uint128 amount) external {
        zkSync.withdrawPendingBalance(address(this), address(0), amount);
    }
}
