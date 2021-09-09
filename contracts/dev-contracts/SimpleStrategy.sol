// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/BaseStrategy.sol";
import "../IERC20.sol";

contract SimpleStrategy is BaseStrategy{

    constructor(address _vault, uint16 _want, address _wantToken) BaseStrategy(_vault, _want, _wantToken) {
    }

    function deposit() override external {}

    function withdraw(uint256 amountNeeded) override external {
        IERC20(wantToken).transfer(vault, amountNeeded);
    }

    function harvest() override external {}

    function migrate(address _newStrategy) override external {
        IERC20(wantToken).transfer(_newStrategy, IERC20(wantToken).balanceOf(address(this)));
    }

    function onMigrate() override external {}

    function emergencyExit() override external {}
}
