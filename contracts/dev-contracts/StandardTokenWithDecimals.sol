// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./StandardToken.sol";

contract StandardTokenWithDecimals is StandardToken {

    uint8 private _decimals;

    constructor (string memory name, string memory symbol, uint8 decimals_) StandardToken(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
