// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the vault contract
/// @author ZkLink Labs
interface IVault {

    /// @notice return want token by id
    /// @param wantId must be erc20 token id
    function wantToken(uint16 wantId) external view returns (address);
}
