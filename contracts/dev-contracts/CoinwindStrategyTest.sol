// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/CoinwindStrategy.sol";

contract CoinwindStrategyTest is CoinwindStrategy {

    address coinwindAddress;
    address vaultAddress;
    address wethAddress;
    address cowAddress;
    address mdxAddress;

    constructor(uint16 _want, uint256 _pid, address _coinwind, address _vault, address _weth, address _cow, address _mdx) CoinwindStrategy(_want, _pid) {
        coinwindAddress = _coinwind;
        vaultAddress = _vault;
        wethAddress = _weth;
        cowAddress = _cow;
        mdxAddress = _mdx;
    }

    function initWant(uint16 _want) override internal {
        want = _want;
    }

    function initCoinwind(uint256 _pid) override internal {
        pid = _pid;
    }

    function initWantToken() external {
        super.initWant(want);
        super.initCoinwind(pid);
    }

    function vault() public override view returns (address) {
        return vaultAddress;
    }

    function weth() public override view returns (address) {
        return wethAddress;
    }

    function coinwind() public override view returns (address) {
        return coinwindAddress;
    }

    function cow() public override view returns (address) {
        return cowAddress;
    }

    function mdx() public override view returns (address) {
        return mdxAddress;
    }
}
