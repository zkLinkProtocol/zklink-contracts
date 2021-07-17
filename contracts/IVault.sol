// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the vault contract
/// @author ZkLink Labs
interface IVault {

    /// @notice return want token by id
    /// @param wantId must be erc20 token id
    function wantToken(uint16 wantId) external view returns (address);

    /// @notice Record user deposit(can only be call by zkSync), after deposit debt of vault will increase
    /// @param tokenId Token id
    /// @param amount Token amount
    function recordDeposit(uint16 tokenId, uint256 amount) external;

    /// @notice Withdraw token from vault to satisfy user withdraw request(can only be call by zkSync)
    /// @notice Withdraw may produce loss, after withdraw debt of vault will decrease
    /// @dev More details see test/vault_withdraw_test.js
    /// @param tokenId Token id
    /// @param to Token receive address
    /// @param amount Amount of tokens to transfer
    /// @param maxAmount Maximum possible amount of tokens to transfer
    /// @param lossBip Loss bip which user can accept, 100 means 1% loss
    /// @return uint256 Amount debt of vault decreased
    function withdraw(uint16 tokenId, address to, uint256 amount, uint256 maxAmount, uint256 lossBip) external returns (uint256);
}
