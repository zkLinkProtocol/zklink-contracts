// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLink.sol";
import "../zksync/SafeCast.sol";
import "../token/IMappingToken.sol";

contract ZkLinkTest is ZkLink {

    function setExodusMode(bool _exodusMode) external {
        exodusMode = _exodusMode;
    }

    function setBalancesToWithdraw(address _account, uint16 _tokenId, uint _balance) external {
        bytes22 packedBalanceKey = packAddressAndTokenId(_account, _tokenId);
        pendingBalances[packedBalanceKey].balanceToWithdraw = SafeCast.toUint128(_balance);
    }

    function setPriorityExpirationBlock(uint64 index, uint64 eb) external {
        priorityRequests[index].expirationBlock = eb;
    }

    function getPubdataHash(uint64 index) external view returns (bytes20) {
        return priorityRequests[index].hashedPubData;
    }

    function hashBytesToBytes20(bytes memory _bytes) external pure returns (bytes20) {
        return Utils.hashBytesToBytes20(_bytes);
    }

    function testRegisterDeposit(
        uint16 _tokenId,
        uint128 _amount,
        address _owner) external {
        registerDeposit(_tokenId, _amount, _owner);
    }

    function getStoredBlockHashes(uint32 height) external view returns (bytes32) {
        return storedBlockHashes[height];
    }

    function addLq(IZkLinkNFT nft, address to, uint16 tokenId, uint128 amount, address pair) external returns (uint32) {
        return nft.addLq(to, tokenId, amount, pair);
    }

    function confirmAddLq(IZkLinkNFT nft, uint32 nftTokenId, uint128 lpTokenAmount) external {
        nft.confirmAddLq(nftTokenId, lpTokenAmount);
    }

    function revokeAddLq(IZkLinkNFT nft, uint32 nftTokenId) external {
        nft.revokeAddLq(nftTokenId);
    }

    function mintZKL(IMappingToken zkl, address to, uint256 amount) external {
        zkl.mint(to, amount);
    }
}
