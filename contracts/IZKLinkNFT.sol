// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma abicoder v2;

/// @title Interface of the ZKLinkNFT
/// @author ZkLink Labs
interface IZKLinkNFT {

    enum LqStatus { NONE, ADD_PENDING, FINAL, ADD_FAIL, REMOVE_PENDING }

    // liquidity info
    struct Lq {
        uint16 tokenId; // token in l2 cross chain pair
        uint128 amount; // liquidity add amount, this is the mine power in stake pool
        address pair; // l2 cross chain pair token address
        LqStatus status;
        uint128 lpTokenAmount; // l2 cross chain pair token amount
    }

    function tokenLq(uint32 nftTokenId) external view returns (Lq memory);
    function addLq(address to, uint16 tokenId, uint128 amount, address pair) external returns (uint32);
    function confirmAddLq(uint32 nftTokenId, uint128 lpTokenAmount) external;
    function revokeAddLq(uint32 nftTokenId) external;
    function removeLq(uint32 nftTokenId) external;
    function confirmRemoveLq(uint32 nftTokenId) external;
    function revokeRemoveLq(uint32 nftTokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
}
