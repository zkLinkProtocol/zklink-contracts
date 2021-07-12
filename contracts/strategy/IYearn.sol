// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../IERC20.sol";

/// @notice interface come from https://github.com/yearn/yearn-vaults/blob/v0.4.2/contracts/Vault.vy
interface IYearn is IERC20{

    // @notice Token that vault accept
    function token() external view returns (address);

    // @notice Gives the price for a single Vault share.
    function pricePerShare() external view returns (uint256);

    // @notice The decimals of want token
    function decimals() external view returns (uint256);

    /**
    @notice Deposits `amount` `token`, issuing shares to `recipient`. If the
        Vault is in Emergency Shutdown, deposits will not be accepted and this
        call will fail.
    @dev Measuring quantity of shares to issues is based on the total
        outstanding debt that this contract has ("expected value") instead
        of the total balance sheet it has ("estimated value") has important
        security considerations, and is done intentionally. If this value were
        measured against external systems, it could be purposely manipulated by
        an attacker to withdraw more assets than they otherwise should be able
        to claim by redeeming their shares.
        On deposit, this means that shares are issued against the total amount
        that the deposited capital can be given in service of the debt that
        Strategies assume. If that number were to be lower than the "expected
        value" at some future point, depositing shares via this method could
        entitle the depositor to *less* than the deposited value once the
        "realized value" is updated from further reports by the Strategies
        to the Vaults.
        Care should be taken by integrators to account for this discrepancy,
        by using the view-only methods of this contract (both off-chain and
        on-chain) to determine if depositing into the Vault is a "good idea".
    @param amount The quantity of tokens to deposit, defaults to all.
    @param recipient The address to issue the shares in this Vault to. Defaults to the caller's address.
    @return The issued Vault shares.
    */
    function deposit(uint256 amount, address recipient) external returns (uint256);

    /**
    @notice Withdraws the calling account's tokens from this Vault, redeeming
        amount `_shares` for an appropriate amount of tokens.
        See note on `setWithdrawalQueue` for further details of withdrawal
        ordering and behavior.
    @dev Measuring the value of shares is based on the total outstanding debt
        that this contract has ("expected value") instead of the total balance
        sheet it has ("estimated value") has important security considerations,
        and is done intentionally. If this value were measured against external
        systems, it could be purposely manipulated by an attacker to withdraw
        more assets than they otherwise should be able to claim by redeeming
        their shares.
        On withdrawal, this means that shares are redeemed against the total
        amount that the deposited capital had "realized" since the point it
        was deposited, up until the point it was withdrawn. If that number
        were to be higher than the "expected value" at some future point,
        withdrawing shares via this method could entitle the depositor to
        *more* than the expected value once the "realized value" is updated
        from further reports by the Strategies to the Vaults.
        Under exceptional scenarios, this could cause earlier withdrawals to
        earn "more" of the underlying assets than Users might otherwise be
        entitled to, if the Vault's estimated value were otherwise measured
        through external means, accounting for whatever exceptional scenarios
        exist for the Vault (that aren't covered by the Vault's own design.)
        In the situation where a large withdrawal happens, it can empty the
        vault balance and the strategies in the withdrawal queue.
        Strategies not in the withdrawal queue will have to be harvested to
        rebalance the funds and make the funds available again to withdraw.
    @param maxShares How many shares to try and redeem for tokens, defaults to all.
    @param recipient The address to issue the shares in this Vault to. Defaults to the caller's address.
    @param maxLoss The maximum acceptable loss to sustain on withdrawal. Defaults to 0.01%.
    @return The quantity of tokens redeemed for `_shares`.
    */
    function withdraw(uint256 maxShares, address recipient, uint256 maxLoss) external returns (uint256);
}
