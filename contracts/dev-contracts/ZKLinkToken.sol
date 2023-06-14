// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ZKLinkToken is ERC20 {

    constructor () ERC20("ZKLink", "ZKL") {
        _mint(msg.sender, 1000000000);
    }
}
