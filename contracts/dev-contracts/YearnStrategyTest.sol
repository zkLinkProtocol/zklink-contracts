// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/YearnStrategy.sol";

contract YearnStrategyTest is YearnStrategy {

    constructor(uint16 _want, IYearn _yearn) YearnStrategy(_want, _yearn) {
    }

    function vault() public override pure returns (address) {
        return address(0xFD6D23eE2b6b136E34572fc80cbCd33E9787705e);
    }

    function weth() public override pure returns (address) {
        return address(0x1D13fF25b10C9a6741DFdce229073bed652197c7);
    }
}
