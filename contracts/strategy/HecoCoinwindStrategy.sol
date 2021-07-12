// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./CoinwindStrategy.sol";

contract HecoCoinwindStrategy is CoinwindStrategy {

    constructor(uint16 _want, uint256 _pid) CoinwindStrategy(_want, _pid) {}

    /// @notice https://hecoinfo.com/token/0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f
    function weth() public override pure returns (address) {
        return address(0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F);
    }

    /// @notice https://hecoinfo.com/address/0x22F560e032b256e8C7Cb50253591B0850162cb74
    function coinwind() public override pure returns (address) {
        return address(0x22F560e032b256e8C7Cb50253591B0850162cb74);
    }

    /// @notice https://hecoinfo.com/token/0x80861A817106665bcA173DB6AC2ab628a738c737
    function cow() public override pure returns (address) {
        return address(0x80861A817106665bcA173DB6AC2ab628a738c737);
    }

    /// @notice https://hecoinfo.com/token/0x25d2e80cb6b86881fd7e07dd263fb79f4abe033c
    function mdx() public override pure returns (address) {
        return address(0x25D2e80cB6B86881Fd7e07dd263Fb79f4AbE033c);
    }
}
