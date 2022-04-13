// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLink.sol";
import "../zksync/SafeCast.sol";

contract ZkLinkTest is ZkLink {

    constructor() {
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
//        registerDeposit(_tokenId, _amount, _owner);
    }

    function getStoredBlockHashes(uint32 height) external view returns (bytes32) {
        return storedBlockHashes[height];
    }
}
