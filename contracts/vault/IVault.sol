// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the vault contract
/// @author ZkLink Labs
interface IVault {

    /// @notice Record user deposit(can only be call by zkSync)
    /// @param tokenId Token id
    function recordDeposit(uint16 tokenId) external;

    /// @notice Commit withdraw (can only be call by zkSync), vault will cache withdraw info
    /// @param tokenId Token id
    /// @param to Token receive address
    /// @param amount Amount of tokens to transfer
    function commitWithdraw(uint16 tokenId, address to, uint256 amount) external;

    /// @notice Exec withdraw (can only be call by zkSync), vault will exec all withdraw in cache
    function execWithdraw() external;

    /// @notice Withdraw token from vault to satisfy user withdraw request(can only be call by zkSync)
    /// @param tokenId Token id
    /// @param to Token receive address
    /// @param amount Amount of tokens to transfer
    function withdraw(uint16 tokenId, address to, uint256 amount) external;
}
