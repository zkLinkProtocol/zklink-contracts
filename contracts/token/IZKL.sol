// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title ZkLink token interface
/// @author zk.link
interface IZKL {

    // @notice Bridge the `amount` of token from `account` to destination chain
    // @param dstChainId - the destination chain flag
    // @param nonce - bridge message nonce
    // @param spender - the address that send bridge message
    // @param from - the address that token bridge from
    // @param to - the address that token bridge to
    // @param amount - the amount of token
    function bridgeTo(uint16 dstChainId, uint64 nonce, address spender, address from, bytes memory to, uint256 amount) external;

    // @notice Bridge the `amount` of token to `account` from source chain
    // @param srcChainId - the source chain flag
    // @param nonce - bridge message nonce
    // @param receiver - the address that token bridge to
    // @param amount - the amount of token
    function bridgeFrom(uint16 srcChainId, uint64 nonce, address receiver, uint256 amount) external;
}
