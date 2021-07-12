// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;
pragma abicoder v2;

import "./BaseStrategy.sol";
import "./ICoinwind.sol";

import "../SafeMath.sol";

/// @notice coinwind strategy
/// user deposited asset to coinwind will remain unchanged
/// user reward token is COW and MDX
abstract contract CoinwindStrategy is BaseStrategy {

    using SafeMath for uint256;

    event Withdraw(uint256 amountNeeded, uint256 depositedBeforeWithdraw, uint256 depositedAfterWithdraw, uint256 loss);

    uint256 public pid;

    constructor(uint16 _want, uint256 _pid) BaseStrategy(_want) {
        initCoinwind(_pid);
    }

    function initCoinwind(uint256 _pid) virtual internal {
        pid = _pid;
        (address token,,,,,,,,,,,) = ICoinwind(coinwind()).poolInfo(_pid);
        require(wantToken == token, 'CoinwindStrategy: want token not match');
    }

    /// @notice coinwind contract address
    function coinwind() public virtual view returns (address);

    /// @notice cow token address
    function cow() public virtual view returns (address);

    /// @notice mdx token address
    function mdx() public virtual view returns (address);

    /// @notice user deposited asset to coinwind will remain unchanged
    function wantNetValue() external override view returns (uint256) {
        uint256 deposited = ICoinwind(coinwind()).getDepositAsset(wantToken, address(this));
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        return balance.add(deposited);
    }

    function deposit() onlyVault external override {
        // coinwind only accept erc20 token, if want is platform token, we should first wrap it
        if (want == 0 && address(this).balance > 0) {
            IWETH(wantToken).deposit{value: address(this).balance}();
        }
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        require(balance > 0, 'CoinwindStrategy: deposit nothing');

        deposit(balance);
    }

    /// @notice coinwind withdraw will harvest before repay token
    function withdraw(uint256 amountNeeded) onlyVault external override returns (uint256) {
        require(amountNeeded > 0, 'CoinwindStrategy: withdraw nothing');

        // make sure deposited token is enough to withdraw
        uint256 depositedBeforeWithdraw = ICoinwind(coinwind()).getDepositAsset(wantToken, address(this));
        require(depositedBeforeWithdraw >= amountNeeded, 'CoinwindStrategy: deposited asset not enough');

        // withdraw want token from coinwind, we must check withdraw loss though coinwind says there is no loss when withdraw
        // according to it's document https://docs.coinwind.com/guide/singlefarms
        uint256 balanceBeforeWithdraw = IERC20(wantToken).balanceOf(address(this));
        ICoinwind(coinwind()).withdraw(wantToken, amountNeeded);
        uint256 balanceAfterWithdraw = IERC20(wantToken).balanceOf(address(this));
        uint256 depositedAfterWithdraw = ICoinwind(coinwind()).getDepositAsset(wantToken, address(this));

        // cal loss and transfer all token of strategy to vault
        uint256 depositedDiff = depositedBeforeWithdraw.sub(depositedAfterWithdraw);
        require(depositedDiff >= amountNeeded, 'CoinwindStrategy: withdraw goal not completed');
        uint256 withdrawn = balanceAfterWithdraw.sub(balanceBeforeWithdraw);
        uint256 loss;
        if (depositedDiff > withdrawn) {
            loss = depositedDiff - withdrawn;
        }
        safeTransferWantTokenToVault(balanceAfterWithdraw);

        emit Withdraw(amountNeeded, depositedBeforeWithdraw, depositedAfterWithdraw, loss);

        return loss;
    }

    /// @notice harvest all pending rewards at once
    function harvest() onlyVault external override {
        // set withdraw amount to zero
        ICoinwind(coinwind()).withdraw(wantToken, 0);

        // transfer reward tokens to vault
        harvestAllRewardTokenToVault();
    }

    function migrate(address _newStrategy) onlyVault external override {
        // withdraw all token with harvest
        ICoinwind(coinwind()).withdrawAll(wantToken);

        // transfer want token to new strategy
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            require(Utils.sendERC20(IERC20(wantToken), _newStrategy, balance), 'CoinwindStrategy: want token transfer failed');
        }

        // transfer reward tokens to vault
        harvestAllRewardTokenToVault();
    }

    /// @notice deposit want token to coinwind if there are any
    function onMigrate() onlyVault external override {
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            deposit(balance);
        }
    }

    /// @notice emergency withdraw from coinwind without harvest
    function emergencyExit() onlyVault external override {
        ICoinwind(coinwind()).emergencyWithdraw(pid);
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            safeTransferWantTokenToVault(balance);
        }
        // we still try send reward token to vault though emergency withdraw of coinwind has no reward
        harvestAllRewardTokenToVault();
    }

    /// @notice deposit amount of token to coinwind
    function deposit(uint256 amount) internal {
        // only approve limited amount of token to coinwind
        IERC20(wantToken).approve(coinwind(), amount);
        ICoinwind(coinwind()).deposit(wantToken, amount);
    }

    /// @notice harvest cow and mdx to vault
    function harvestAllRewardTokenToVault() internal {
        harvestRewardTokenToVault(cow());
        harvestRewardTokenToVault(mdx());
    }

    /// @notice harvest reward token to vault
    function harvestRewardTokenToVault(address rewardToken) internal {
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        if (balance > 0) {
            require(Utils.sendERC20(IERC20(rewardToken), vault(), balance), 'CoinwindStrategy: reward token transfer failed');
            emit Harvest(want, rewardToken, balance);
        }
    }
}
