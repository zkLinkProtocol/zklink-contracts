// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../ZkLinkPeriphery.sol";

contract ZkLinkPeripheryTest is ZkLinkPeriphery {

    function setGovernor(address governor) external {
        networkGovernor = governor;
    }

    function setAcceptor(bytes32 hash, address acceptor) external {
        accepts[hash] = acceptor;
    }

    function getAcceptor(bytes32 hash) external view returns (address) {
        return accepts[hash];
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
