// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC721Tradable.sol";

/// @title ZkLinkNFT, a contract for user add liquidity voucher. The owner of ZkLinkNFT is ZkLink contract
/// @author zk.link
contract ZkLinkNFT is ERC721Tradable {
    using Address for address;

    // liquidity status
    // l1 add liquidity: mint nft and set status to ADD_PENDING
    // l2 confirm add success: ADD_PENDING -> FINAL, set l2 token id and amount
    // l2 confirm add fail: ADD_PENDING -> ADD_FAIL, token can be transferred at this status
    // l1 remove liquidity: set status to REMOVE_PENDING and nft can not transfer anymore
    // l2 confirm remove success: burn this nft
    // l2 confirm remove fail: set status to FINAL
    enum LqStatus { NONE, ADD_PENDING, FINAL, ADD_FAIL, REMOVE_PENDING }

    /// @notice event emit when nft status update
    event StatusUpdate(uint32 nftTokenId, LqStatus status);

    // liquidity info
    struct Lq {
        uint16 tokenId; // token in l2 cross chain pair
        uint128 amount; // liquidity add amount, this is the mine power in stake pool
        address pair; // l2 cross chain pair token address
        LqStatus status;
        uint128 lpTokenAmount; // l2 cross chain pair token amount
    }

    // token id to liquidity info
    mapping(uint32 => Lq) public tokenLq;

    constructor(address _proxyRegistryAddress)
        ERC721Tradable("ZkLinkNFT", "ZKLNFT", _proxyRegistryAddress)
    {}

    function baseTokenURI() override public pure returns (string memory) {
        return "https://zk.link/api/nft/";
    }

    /// @notice Get all tokens of owner
    function totalOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory totalTokens = new uint256[](balance);
        for(uint256 i = 0; i < balance; i++) {
            totalTokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        return totalTokens;
    }

    /**
     * @notice Mints a token to an address with a tokenURI.
     * @param to address of the future owner of the token
     * @param tokenId token in l2 cross chain pair
     * @param amount token amount to add liquidity
     * @param pair l2 cross chain pair address
     */
    function addLq(address to, uint16 tokenId, uint128 amount, address pair) external onlyOwner returns (uint32) {
        uint256 nftTokenIdRaw = mintTo(to);
        require(nftTokenIdRaw < 2**32, 'ZkLinkNFT: nftTokenId');
        uint32 nftTokenId = uint32(nftTokenIdRaw);

        Lq storage lq = tokenLq[nftTokenId];
        lq.tokenId = tokenId;
        lq.amount = amount;
        lq.pair = pair;
        lq.status = LqStatus.ADD_PENDING;
        emit StatusUpdate(nftTokenId, LqStatus.ADD_PENDING);
        return nftTokenId;
    }

    /**
     * @notice Confirm when L2 add liquidity success
     * @param nftTokenId nft id
     * @param lpTokenAmount lp token amount
     */
    function confirmAddLq(uint32 nftTokenId, uint128 lpTokenAmount) external onlyOwner {
        require(_exists(nftTokenId), "ZkLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.ADD_PENDING, 'ZkLinkNFT: require ADD_PENDING');

        tokenLq[nftTokenId].status = LqStatus.FINAL;
        tokenLq[nftTokenId].lpTokenAmount = lpTokenAmount;
        emit StatusUpdate(nftTokenId, LqStatus.FINAL);
    }

    /**
     * @notice Confirm when L2 add liquidity fail
     * @param nftTokenId nft id
     */
    function revokeAddLq(uint32 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZkLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.ADD_PENDING, 'ZkLinkNFT: require ADD_PENDING');

        tokenLq[nftTokenId].status = LqStatus.ADD_FAIL;
        emit StatusUpdate(nftTokenId, LqStatus.ADD_FAIL);
    }

    /**
     * @notice Remove liquidity
     * @param nftTokenId nft id
     */
    function removeLq(uint32 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZkLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.FINAL, 'ZkLinkNFT: require FINAL');

        tokenLq[nftTokenId].status = LqStatus.REMOVE_PENDING;
        emit StatusUpdate(nftTokenId, LqStatus.REMOVE_PENDING);
    }

    /**
     * @notice Confirm when L2 remove liquidity success
     * @param nftTokenId nft id
     */
    function confirmRemoveLq(uint32 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZkLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.REMOVE_PENDING, 'ZkLinkNFT: require REMOVE_PENDING');

        _burn(nftTokenId);
        delete tokenLq[nftTokenId];
    }

    /**
     * @notice Revoke when L2 remove liquidity fail
     * @param nftTokenId nft id
     */
    function revokeRemoveLq(uint32 nftTokenId) external onlyOwner {
        require(_exists(nftTokenId), "ZkLinkNFT: nonexistent token");
        require(tokenLq[nftTokenId].status == LqStatus.REMOVE_PENDING, 'ZkLinkNFT: require REMOVE_PENDING');

        tokenLq[nftTokenId].status = LqStatus.FINAL;
        emit StatusUpdate(nftTokenId, LqStatus.FINAL);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override {
        super._beforeTokenTransfer(from, to, tokenId);

        // nft can burn but not transfer when at REMOVE_PENDING status
        if (to != address(0)) {
            require(tokenLq[uint32(tokenId)].status != LqStatus.REMOVE_PENDING, 'ZkLinkNFT: require !REMOVE_PENDING');
        }
    }
}
