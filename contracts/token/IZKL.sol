// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title ZkLink token interface
/// @author zk.link
interface IZKL {

    // @notice Bridge the `amount` of token from `account` to destination chain
    // @param spender - the address that send bridge message
    // @param from - the address that token bridge from
    // @param amount - the amount of token
    function bridgeTo(address spender, address from, uint256 amount) external;

    // @notice Bridge the `amount` of token to `account` from source chain
    // @param receiver - the address that token bridge to
    // @param amount - the amount of token
    function bridgeFrom(address receiver, uint256 amount) external;
}
