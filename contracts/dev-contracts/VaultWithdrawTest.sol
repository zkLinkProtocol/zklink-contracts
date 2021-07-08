// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../SafeMath.sol";

/// @notice this contract just simulate of numerical changes in withdraw of Vault.sol
contract VaultWithdrawTest {

    using SafeMath for uint256;

    event Simulate(uint256 amount, uint256 loss, uint256 debtDecrease);

    uint16 constant MAX_BPS = 10000;  // 100%, or 10k basis points

    function simulate(uint256 amount, uint256 maxAmount, uint256 lossBip,
        uint256 balanceBefore,
        uint256 lossFromStrategy,
        uint256 balanceAfterStrategyWithdraw,
        uint256 balanceAfter)
    external {
        uint256 loss;
//        uint256 balanceBefore = _tokenBalance(tokenId);
        if (balanceBefore < amount) {
            uint256 withdrawNeeded = amount - balanceBefore;
//            loss = IStrategy(strategy).withdraw(withdrawNeeded);
            loss = lossFromStrategy;
            require(loss < withdrawNeeded, 'Vault: too large loss');

//            uint256 balanceAfterStrategyWithdraw = _tokenBalance(tokenId);
            require(withdrawNeeded <= balanceAfterStrategyWithdraw.sub(balanceBefore).add(loss), 'Vault: withdraw goal not completed');
            balanceBefore = balanceAfterStrategyWithdraw;
            amount = amount.sub(loss);
        }

//        _safeTransferToken(tokenId, to, amount);
//        uint256 balanceAfter = _tokenBalance(tokenId);
        uint256 debtDecrease = balanceBefore.sub(balanceAfter).add(loss);
        require(debtDecrease <= maxAmount, 'Vault: over maxAmount');
        loss = debtDecrease.sub(amount);
        require(loss.mul(MAX_BPS).div(debtDecrease) <= lossBip, 'Vault: over loss');

        emit Simulate(amount, loss, debtDecrease);
    }
}
