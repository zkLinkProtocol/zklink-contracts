// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StandardToken is ERC20 {

    constructor (string memory name, string memory symbol) ERC20(name, symbol) {
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
