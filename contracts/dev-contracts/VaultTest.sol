// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../vault/Vault.sol";

contract VaultTest is Vault {
    using SafeMath for uint256;

    function setStrategyTakeEffectTime(uint16 tokenId, uint256 time) external {
        tokenVaults[tokenId].takeEffectTime = time;
    }

    function buildActiveTest(uint16 tokenId, address strategy) external {
        TokenVault storage tv = tokenVaults[tokenId];
        tv.strategy = strategy;
        tv.takeEffectTime = 0;
        tv.status = StrategyStatus.ACTIVE;
    }

    function buildMigrateTest(uint16 tokenId, address strategyA, address strategyB) external {
        TokenVault storage tv = tokenVaults[tokenId];
        tv.strategy = strategyA;
        tv.nextStrategy = strategyB;
        tv.takeEffectTime = 0;
        tv.status = StrategyStatus.PREPARE_UPGRADE;
    }

    function getStrategy(uint16 tokenId) external view returns (address) {
        return tokenVaults[tokenId].strategy;
    }

    function getNextStrategy(uint16 tokenId) external view returns (address) {
        return tokenVaults[tokenId].nextStrategy;
    }

    function withdrawFromStrategyTest(uint16 tokenId, uint256 amount) external {
        TokenVault memory tv = tokenVaults[tokenId];
        address strategy = tv.strategy;
        IStrategy(strategy).withdraw(amount);
    }

    function strategyActiveWaitTime() override public pure returns (uint256) {
        return 7 days;
    }
}
