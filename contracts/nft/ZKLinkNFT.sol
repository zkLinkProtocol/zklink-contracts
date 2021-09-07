// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC721Tradable.sol";

/**
 * @title ZKLinkNFT
 * ZKLinkNFT - a contract for user add liquidity voucher
 * The owner of ZKLinkNFT is ZKLink contract
 */
contract ZKLinkNFT is ERC721Tradable {
    using Address for address;

    // liquidity status
    // l1 add liquidity: mint nft and set status to ADD_PENDING
    // l2 confirm add success: ADD_PENDING -> FINAL, set l2 token id and amount
    // l2 confirm add fail: ADD_PENDING -> ADD_FAIL, token can be transferred at this status
    // l1 remove liquidity: set status to REMOVE_PENDING and nft can not transfer anymore
    // l2 confirm remove success: burn this nft
    // l2 confirm remove fail: set status to FINAL
    enum LqStatus { NONE, ADD_PENDING, FINAL, ADD_FAIL, REMOVE_PENDING }

    // liquidity info
    struct Lq {
        uint16 tokenId; // token in l2 cross chain pair
        uint128 amount; // liquidity add amount, this is the mine power in stake pool
        LqStatus status;
        uint16 lpTokenId; // l2 cross chain pair token id
        uint128 lpTokenAmount; // l2 cross chain pair token amount
    }

    // token id to liquidity info
    mapping(uint256 => Lq) public tokenLq;

    constructor(address _proxyRegistryAddress)
        ERC721Tradable("ZKLinkNFT", "ZKLNFT", _proxyRegistryAddress)
    {}

    function baseTokenURI() override public pure returns (string memory) {
        return "https://zk.link/api/nft/";
    }

    /**
     * @dev Mints a token to an address with a tokenURI.
     * @param to address of the future owner of the token
     * @param tokenId token in l2 cross chain pair
     * @param amount token amount to add liquidity
     */
    function addLq(address to, uint16 tokenId, uint128 amount) external onlyOwner {
        uint256 nftTokenId = mintTo(to);
        Lq storage lq = tokenLq[nftTokenId];
        lq.tokenId = tokenId;
        lq.amount = amount;
        lq.status = LqStatus.ADD_PENDING;
    }

    function confirmAddLq(uint256 nftTokenId, uint16 lpTokenId, uint128 lpTokenAmount) external onlyOwner {
        require(_exists(nftTokenId), "ZKLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.ADD_PENDING, 'ZKLinkNFT: require ADD_PENDING');

        tokenLq[nftTokenId].status = LqStatus.FINAL;
        tokenLq[nftTokenId].lpTokenId = lpTokenId;
        tokenLq[nftTokenId].lpTokenAmount = lpTokenAmount;
    }

    function revokeAddLq(uint256 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZKLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.ADD_PENDING, 'ZKLinkNFT: require ADD_PENDING');

        tokenLq[nftTokenId].status = LqStatus.ADD_FAIL;
    }

    function removeLq(uint256 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZKLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.FINAL, 'ZKLinkNFT: require FINAL');

        tokenLq[nftTokenId].status = LqStatus.REMOVE_PENDING;
    }

    function confirmRemoveLq(uint256 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZKLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.REMOVE_PENDING, 'ZKLinkNFT: require REMOVE_PENDING');

        _burn(nftTokenId);
        delete tokenLq[nftTokenId];
    }

    function revokeRemoveLq(uint256 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZKLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.REMOVE_PENDING, 'ZKLinkNFT: require REMOVE_PENDING');

        tokenLq[nftTokenId].status = LqStatus.FINAL;
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override {
        super._beforeTokenTransfer(from, to, tokenId);

        require(tokenLq[tokenId].status != LqStatus.REMOVE_PENDING, 'ZKLinkNFT: require !REMOVE_PENDING');
    }
}
