// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title Interface of the ZKLinkNFT
/// @author ZkLink Labs
interface IZKLinkNFT {

    function addLq(address to, uint16 tokenId, uint128 amount, address pair) external returns (uint32);
    function confirmAddLq(uint32 nftTokenId, uint128 lpTokenAmount) external;
    function revokeAddLq(uint32 nftTokenId) external;
    function removeLq(uint32 nftTokenId) external;
    function confirmRemoveLq(uint32 nftTokenId) external;
    function revokeRemoveLq(uint32 nftTokenId) external;
}
