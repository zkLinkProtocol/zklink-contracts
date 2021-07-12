// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/IYearn.sol";
import "./ERC20.sol";
import "./MockYearnBorrower.sol";

/// @notice simplified version of yearn vault
contract MockYearn is IYearn, ERC20{

    uint256 public constant MAX_BPS = 10000; // 100%, or 10k basis points

    address public override token;
    MockYearnBorrower public borrower;

    constructor(address _token, uint256 amount) ERC20(amount) {
        token = _token;
        borrower = new MockYearnBorrower(_token);
    }

    function pricePerShare() external override view returns (uint256) {
        return _shareValue(10 ** decimals());
    }

    function decimals() public pure override returns (uint256) {
        return 18;
    }

    function _shareValue(uint256 shares) internal view returns (uint256) {
        //  Returns price = 1:1 if vault is empty
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) {
            return shares;
        }
        uint256 freeFunds = totalAssets();
        return shares * freeFunds / totalSupply;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) + borrower.totalAssets();
    }

    function deposit(uint256 amount, address recipient) external override returns (uint256) {
        // Issue new shares (needs to be done before taking deposit to be accurate)
        // Shares are issued to recipient (may be different from msg.sender)
        uint256 shares = _issueSharesForAmount(recipient, amount);
        IERC20(token).transferFrom(_msgSender(), address(borrower), amount);
        return shares;
    }

    function _issueSharesForAmount(address to, uint256 amount) internal returns(uint256) {
        // Issues `amount` Vault shares to `to`.
        // Shares must be issued prior to taking on new collateral, or
        // calculation will be wrong. This means that only *trusted* tokens
        // (with no capability for exploitative behavior) can be used.
        uint256 shares;
        uint256 totalSupply = totalSupply();
        if (totalSupply > 0) {
            uint256 freeFunds = totalAssets();
            shares = amount * totalSupply / freeFunds;
        } else {
            shares = amount;
        }
        _mint(to, shares);
        return shares;
    }

    function withdraw(uint256 maxShares, address recipient, uint256 maxLoss) external override returns (uint256) {
        uint256 shares = maxShares; // May reduce this number below
        uint256 value = _shareValue(shares);
        uint256 totalLoss;
        uint256 vault_balance = IERC20(token).balanceOf(address(this));
        if (value > vault_balance) {
            uint256 amountNeeded = value - vault_balance;
            // Force withdraw amount from each Strategy in the order set by governance
            uint256 loss = borrower.withdraw(amountNeeded);
            // NOTE: Withdrawer incurs any losses from liquidation
            if (loss > 0) {
                value -= loss;
                totalLoss += loss;
            }
            // NOTE: We have withdrawn everything possible out of the withdrawal queue
            // but we still don't have enough to fully pay them back, so adjust
            // to the total amount we've freed up through forced withdrawals
            vault_balance = IERC20(token).balanceOf(address(this));
            if (value > vault_balance) {
                value = vault_balance;
                // NOTE: Burn # of shares that corresponds to what Vault has on-hand,
                // including the losses that were incurred above during withdrawals
                shares = _sharesForAmount(value + totalLoss);
            }
        }
        // NOTE: This loss protection is put in place to revert if losses from
        // withdrawing are more than what is considered acceptable.
        require(totalLoss <= maxLoss * (value + totalLoss) / MAX_BPS);
        // Burn shares (full value of what is being withdrawn)
        _burn(_msgSender(), shares);
        // Withdraw remaining balance to _recipient (may be different to msg.sender) (minus fee)
        IERC20(token).transfer(recipient, value);
        return value;
    }

    function _sharesForAmount(uint256 amount) internal view returns (uint256) {
        // Determines how many shares `amount` of token would receive.
        uint256 freeFunds = totalAssets();
        uint256 totalSupply = IERC20(token).balanceOf(address(this));
        if (freeFunds > 0) {
            return amount * totalSupply / freeFunds;
        } else {
            return 0;
        }
    }
}
