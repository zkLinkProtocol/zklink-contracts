// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../Vault.sol";

contract VaultTest is Vault {
    using SafeMath for uint256;

    /// @notice Return the total amount of token in this vault and strategy if exist
    /// @param tokenId Token id
    function totalAsset(uint16 tokenId) public view returns (uint256) {
        address strategy = tokenVaults[tokenId].strategy;
        if (strategy != address(0)) {
            return _tokenBalance(tokenId).add(IStrategy(strategy).wantNetValue());
        } else {
            return _tokenBalance(tokenId);
        }
    }

    /// @notice Return amount of debt owned by this vault
    /// @param tokenId Token id
    function totalDebt(uint16 tokenId) external view returns (uint256) {
        return tokenVaults[tokenId].debt;
    }

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
}
