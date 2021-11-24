// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkLinkExit.sol";

contract ZkLinkUser {

    ZkLinkExit public zkLink;

    constructor(address payable _zkLink) {
        zkLink = ZkLinkExit(_zkLink);
    }

    receive() external payable {}

    function withdrawETH(uint128 amount) external {
        zkLink.withdrawPendingBalance(address(this), address(0), amount);
    }
}
