// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLinkPeriphery.sol";

contract ZkLinkPeripheryTest is ZkLinkPeriphery {

    function setAccepter(uint32 accountId, bytes32 hash, address accepter) external {
        accepts[accountId][hash] = accepter;
    }

    function getAccepter(uint32 accountId, bytes32 hash) external view returns (address) {
        return accepts[accountId][hash];
    }

    function setGov(Governance gov) external {
        governance = gov;
    }

    function mockProveBlock(StoredBlockInfo memory storedBlockInfo) external {
        storedBlockHashes[storedBlockInfo.blockNumber] = hashStoredBlockInfo(storedBlockInfo);
        totalBlocksProven = storedBlockInfo.blockNumber;
    }

    function getAuthFact(address account, uint32 nonce) external view returns (bytes32) {
        return authFacts[account][nonce];
    }

    function setTotalOpenPriorityRequests(uint64 _totalOpenPriorityRequests) external {
        totalOpenPriorityRequests = _totalOpenPriorityRequests;
    }

    function setSyncProgress(bytes32 syncHash, uint256 progress) external {
        synchronizedChains[syncHash] = progress;
    }
}
