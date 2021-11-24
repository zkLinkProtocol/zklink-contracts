// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the vault contract
/// @author ZkLink Labs
interface IVault {

    /// @notice Record user deposit(can only be call by zkSync)
    /// @param tokenId Token id
    function recordDeposit(uint16 tokenId) external;

    /// @notice Withdraw token from vault to satisfy user withdraw request(can only be call by zkSync)
    /// @dev More details see test/vault_withdraw_test.js
    /// @param tokenId Token id
    /// @param to Token receive address
    /// @param amount Amount of tokens to transfer
    function withdraw(uint16 tokenId, address to, uint256 amount) external;
}
