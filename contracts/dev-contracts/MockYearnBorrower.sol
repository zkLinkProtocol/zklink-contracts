// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ERC20.sol";

/// @notice simplified version of yearn vault borrower
contract MockYearnBorrower {

    address public token;

    constructor (address _token) {
        token = _token;
    }

    function weth() public pure returns (address) {
        return address(0x1D13fF25b10C9a6741DFdce229073bed652197c7);
    }

    /// @notice use the balance to represent nominal asset of borrower
    function totalAssets() external view returns (uint256) {
        return ERC20(token).balanceOf(address(this));
    }

    uint256 simulateCase;
    uint256 amountReturnToYearn;
    uint256 lossHappenAtWithdraw;
    /// @notice simulate vault withdraw from borrower, only support normal erc20 token
    function setSimulate(uint256 c, uint256 amount, uint256 loss) external {
        simulateCase = c;
        amountReturnToYearn = amount;
        lossHappenAtWithdraw = loss;
    }

    /// assume total shares = 1000, yearn balance = 0, yearn borrower nominal balance = 1000
    /// the amount of borrower really return back to yearn can be different with nominal balance
    /// the repay back amount of withdraw from yearn borrower can be >, =, < amountNeeded
    /// the loss of withdraw can be >, = 0
    /// so total 3 * 2 = 6 conditions
    /// case 1: withdraw 500 shares, no loss, repayBackAmount = amountNeeded, call setSimulate(500, 0)
    ///     then yearn balance = 500, borrower nominal balance = 500
    ///     then total shares = 500, transfer to withdrawer amount = 500
    /// case 2: withdraw 500 shares, no loss, repayBackAmount > amountNeeded, call setSimulate(501, 0)
    ///     then yearn balance = 501, borrower nominal balance = 500
    ///     then total shares = 500, transfer to withdrawer amount = 500
    /// case 3: withdraw 500 shares, no loss, repayBackAmount < amountNeeded, call setSimulate(499, 0)
    ///     then yearn balance = 499, borrower nominal balance = 500
    ///     then total shares = 500, transfer to withdrawer amount < 500
    /// case 4: withdraw 500 shares, loss > 0, repayBackAmount = amountNeeded, call setSimulate(500, 1)
    ///     then yearn balance = 500, borrower nominal balance = 499
    ///     then total shares = 500, transfer to withdrawer amount < 500
    /// case 5: withdraw 500 shares, loss > 0, repayBackAmount > amountNeeded, call setSimulate(501, 3)
    ///     then yearn balance = 501, borrower nominal balance = 497
    ///     then total shares = 501, transfer to withdrawer amount < 500
    /// case 6: withdraw 500 shares, loss > 0, repayBackAmount < amountNeeded, call setSimulate(499, 3)
    ///     then yearn balance = 499, borrower nominal balance = 497
    ///     then total shares = 500, transfer to withdrawer amount < 500
    function withdraw(uint256 amountNeeded) external returns (uint256) {
        if (token == weth()) {
            ERC20(token).transfer(msg.sender, amountNeeded);
            return 0;
        } else {
            if (simulateCase == 1) {
                require(amountReturnToYearn == amountNeeded, 'w0');
                require(lossHappenAtWithdraw == 0, 'w1');
            } else if (simulateCase == 2) {
                require(amountReturnToYearn > amountNeeded, 'w2');
                require(lossHappenAtWithdraw == 0, 'w3');
            } else if (simulateCase == 3) {
                require(amountReturnToYearn < amountNeeded, 'w4');
                require(lossHappenAtWithdraw == 0, 'w5');
            } else if (simulateCase == 4) {
                require(amountReturnToYearn == amountNeeded, 'w6');
                require(lossHappenAtWithdraw > 0, 'w7');
            } else if (simulateCase == 5) {
                require(amountReturnToYearn > amountNeeded, 'w8');
                require(lossHappenAtWithdraw > 0, 'w9');
            } else if (simulateCase == 6) {
                require(amountReturnToYearn < amountNeeded, 'w10');
                require(lossHappenAtWithdraw > 0, 'w11');
            }
            ERC20(token).burnFrom(address(this), amountNeeded + lossHappenAtWithdraw);
            ERC20(token).mintTo(msg.sender, amountReturnToYearn);
            return lossHappenAtWithdraw;
        }
    }
}
