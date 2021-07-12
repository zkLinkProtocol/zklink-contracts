// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../SafeMath.sol";

import "./BaseStrategy.sol";
import "./IYearn.sol";

/// @title Yearn strategy
/// NOTE: Yearn only support 'trusted' token which take no fees at transfer
/// @author ZkLink Labs
contract YearnStrategy is BaseStrategy {

    using SafeMath for uint256;

    event Withdraw(uint256 amountNeeded, uint256 pricePerShare, uint256 sharesBeforeWithdraw, uint256 sharesAfterWithdraw, uint256 loss);

    uint256 constant MAX_BPS = 10000; // 100%, or 10k basis points

    IYearn public yearn; // each want token has a yearn vault

    constructor(uint16 _want, IYearn _yearn) BaseStrategy(_want) {
        initYearn(_yearn);
    }

    function initYearn(IYearn _yearn) virtual internal {
        yearn = _yearn;
        require(wantToken == yearn.token(), 'YearnStrategy: unmatched token');
    }

    /// @notice yearn strategy run in eth main net
    /// https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    function weth() public override virtual view returns (address) {
        return address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    /**
    @notice User deposit want token to yearn vault, and yearn vault will convert any other harvested earn token to want token
        this strategy want net value = want token balance of this + shares value of this
    */
    function wantNetValue() external override view returns (uint256) {
        uint256 pricePerShare = yearn.pricePerShare();
        uint256 shares = yearn.balanceOf(address(this));
        uint256 sharesValue = calSharesValue(shares, pricePerShare);
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        return balance.add(sharesValue);
    }

    function deposit() onlyVault external override {
        // yearn only accept erc20 token, if want is platform token, we should first wrap it
        if (want == 0 && address(this).balance > 0) {
            IWETH(wantToken).deposit{value: address(this).balance}();
        }

        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        require(balance > 0, 'YearnStrategy: deposit nothing');

        deposit(balance);
    }

    function withdraw(uint256 amountNeeded) onlyVault external override returns (uint256) {
        require(amountNeeded > 0, 'YearnStrategy: withdraw nothing');

        // make sure withdrawn shares value can meet amountNeeded
        uint256 pricePerShare = yearn.pricePerShare();
        uint256 sharesNeeded = calSharesAmount(amountNeeded, pricePerShare);
        if (calSharesValue(sharesNeeded, pricePerShare) < amountNeeded) {
            sharesNeeded = sharesNeeded.add(1);
        }

        uint256 sharesBeforeWithdraw = yearn.balanceOf(address(this));
        require(sharesBeforeWithdraw >= sharesNeeded, 'YearnStrategy: shares not enough');

        // withdraw want token without regard to loss
        uint256 withdrawn = yearn.withdraw(sharesNeeded, address(this), MAX_BPS);

        // yearn will withdraw everything possible but still may have not enough to fully pay them back
        // so yearn will adjust to the total amount freed up through forced withdrawals
        // in this case, the withdraw goal is not completed and user should decrease the amount want to withdraw from zklink vault
        uint256 sharesAfterWithdraw = yearn.balanceOf(address(this));
        uint256 sharesDiff = sharesBeforeWithdraw.sub(sharesAfterWithdraw);
        uint256 sharesValueDiff = calSharesValue(sharesDiff, pricePerShare);
        require(sharesValueDiff >= amountNeeded, 'YearnStrategy: withdraw goal not completed');

        // cal loss and transfer all token of strategy to vault
        uint256 loss = sharesValueDiff.sub(withdrawn);
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        safeTransferWantTokenToVault(balance);

        emit Withdraw(amountNeeded, pricePerShare, sharesBeforeWithdraw, sharesAfterWithdraw, loss);

        return loss;
    }

    /// @notice no harvest in yearn
    function harvest() onlyVault external override {}

    /// @notice migrate shares and token to new strategy
    function migrate(address _newStrategy) onlyVault external override {
        // withdraw all shares from yearn may produce large loss so we just transfer shares to new strategy
        // whether keep holding shares or withdraw them from yearn is determined by new strategy
        uint256 shares = yearn.balanceOf(address(this));
        if (shares > 0) {
            require(Utils.sendERC20(yearn, _newStrategy, shares), 'YeanStrategy: shares transfer failed');
        }
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            require(Utils.sendERC20(IERC20(wantToken), _newStrategy, balance), 'YeanStrategy: want token transfer failed');
        }
    }

    /// @notice keeping hold shares and deposit want token to yearn if there are any
    function onMigrate() onlyVault external override {
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            deposit(balance);
        }
    }

    /// @notice withdraw all shares to vault
    function emergencyExit() onlyVault external override {
        uint256 shares = yearn.balanceOf(address(this));
        if (shares > 0) {
            yearn.withdraw(shares, address(this), MAX_BPS);
        }
        uint256 balance = IERC20(wantToken).balanceOf(address(this));
        if (balance > 0) {
            safeTransferWantTokenToVault(balance);
        }
    }

    /// @notice cal shares value, pricePerShare of yearn will be enlarged by 10 ** decimals
    function calSharesValue(uint256 shares, uint256 pricePerShare) internal view returns (uint256) {
        return shares.mul(pricePerShare).div(10 ** yearn.decimals());
    }

    /// @notice cal shares amount of value, pricePerShare of yearn will be enlarged by 10 ** decimals
    function calSharesAmount(uint256 value, uint256 pricePerShare) internal view returns (uint256) {
        return value.mul(10 ** yearn.decimals()).div(pricePerShare);
    }

    /// @notice deposit amount of token to yearn
    function deposit(uint256 amount) internal {
        // only approve limited amount of token to yearn
        IERC20(wantToken).approve(address(yearn), amount);
        yearn.deposit(amount, address(this));
    }
}
