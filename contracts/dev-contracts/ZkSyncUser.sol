// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkSyncExit.sol";

contract ZkSyncUser {

    ZkSyncExit public zkSync;

    constructor(address payable _zkSync) {
        zkSync = ZkSyncExit(_zkSync);
    }

    receive() external payable {}

    function withdrawETH(uint128 amount) external {
        zkSync.withdrawPendingBalance(address(this), address(0), amount);
    }
}
