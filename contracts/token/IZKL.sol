// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title ZkLink token interface
/// @author zk.link
interface IZKL {

    // @notice Bridge the `amount` of token from `account` to destination chain
    // @param spender - the address that send bridge message
    // @param sender - the address that token bridge from
    // @param dstChainId - the destination chain flag
    // @param to - the address that token bridge to
    // @param amount - the amount of token
    // @param nonce - bridge message nonce
    function bridgeTo(address spender, address from, uint16 dstChainId, bytes memory to, uint256 amount, uint64 nonce) external;

    // @notice Bridge the `amount` of token to `account` from source chain
    // @param srcChainId - the source chain flag
    // @param receiver - the address that token bridge to
    // @param amount - the amount of token
    // @param nonce - bridge message nonce
    function bridgeFrom(uint16 srcChainId, address receiver, uint256 amount, uint64 nonce) external;
}
