// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./StandardToken.sol";

contract NonStandardToken is StandardToken {

    constructor (string memory name, string memory symbol) StandardToken(name, symbol) {
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._transfer(from, to, amount);

        if (from != address(0)) {
            // take 10% fee
            _burn(from, amount / 10);
        }
        if (to != address(0)) {
            // take 20% fee
            _burn(to, amount / 5);
        }
    }
}
