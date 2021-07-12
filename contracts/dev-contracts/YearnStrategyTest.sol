// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/YearnStrategy.sol";

contract YearnStrategyTest is YearnStrategy {

    address public vaultAddress;
    address public wethAddress;

    constructor(uint16 _want, IYearn _yearn, address _vault, address _weth) YearnStrategy(_want, _yearn) {
        vaultAddress = _vault;
        wethAddress = _weth;
    }

    function initWant(uint16 _want) override internal {
        want = _want;
    }

    function initYearn(IYearn _yearn) override internal {
        yearn = _yearn;
    }

    function vault() public override view returns (address) {
        return vaultAddress;
    }

    function weth() public override view returns (address) {
        return wethAddress;
    }

    function initWantToken() external {
        super.initWant(want);
        super.initYearn(yearn);
    }
}
