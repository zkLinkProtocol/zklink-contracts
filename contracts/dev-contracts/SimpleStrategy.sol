// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/BaseStrategy.sol";
import "./ERC20.sol";

contract SimpleStrategy is BaseStrategy{

    address[] public rts;
    uint256[] public harvestAmounts;

    constructor(address _vault, uint16 _want, address _wantToken, address _stakePool, address[] memory _rewardTokens) BaseStrategy(_vault, _want, _wantToken, _stakePool) {
        rts = _rewardTokens;
    }

    function deposit() override external {}

    function withdraw(uint256 amountNeeded) override external {
        ERC20(wantToken).transfer(vault, amountNeeded);
    }

    function rewardTokens() override external view returns (address[] memory) {
        return rts;
    }

    function setHarvestAmounts(uint256[] memory _amounts) external {
        require(_amounts.length == rts.length, 'SimpleStrategy: amounts length');
        harvestAmounts = _amounts;
    }

    function harvest() onlyStakePool override external returns (uint256[] memory) {
        for(uint256 i = 0; i < rts.length; i++) {
            ERC20(rts[i]).mintTo(stakePool, harvestAmounts[i]);
        }
        return harvestAmounts;
    }

    function migrate(address _newStrategy) override external {
        ERC20(wantToken).transfer(_newStrategy, IERC20(wantToken).balanceOf(address(this)));
    }

    function onMigrate() override external {}

    function emergencyExit() override external {}
}
