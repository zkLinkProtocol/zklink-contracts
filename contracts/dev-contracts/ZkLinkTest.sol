// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLink.sol";

contract ZkLinkTest is ZkLink {

    function setGov(Governance gov) external {
        governance = gov;
    }

    function setExodus(bool _exodusMode) external {
        exodusMode = _exodusMode;
    }

    function setTotalOpenPriorityRequests(uint64 _totalOpenPriorityRequests) external {
        totalOpenPriorityRequests = _totalOpenPriorityRequests;
    }

    function setPriorityExpirationBlock(uint64 index, uint64 eb) external {
        priorityRequests[index].expirationBlock = eb;
    }

    function getPriorityHash(uint64 index) external view returns (bytes20) {
        return priorityRequests[index].hashedPubData;
    }

    function setAccepter(uint32 accountId, bytes32 hash, address accepter) external {
        periphery.setAccepter(accountId, hash, accepter);
    }

    function getStoredBlockHashes(uint32 height) external view returns (bytes32) {
        return storedBlockHashes[height];
    }

    function mockExecBlock(StoredBlockInfo memory storedBlockInfo) external {
        storedBlockHashes[storedBlockInfo.blockNumber] = hashStoredBlockInfo(storedBlockInfo);
        totalBlocksExecuted = storedBlockInfo.blockNumber;
    }

    function mockProveBlock(StoredBlockInfo memory storedBlockInfo) external {
        storedBlockHashes[storedBlockInfo.blockNumber] = hashStoredBlockInfo(storedBlockInfo);
        totalBlocksProven = storedBlockInfo.blockNumber;
    }
}
