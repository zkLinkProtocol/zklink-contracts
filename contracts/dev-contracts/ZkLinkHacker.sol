// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

contract ZkLinkHacker {

    function destroy() external {
        selfdestruct(msg.sender);
    }
}
