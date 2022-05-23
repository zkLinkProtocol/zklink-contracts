// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLinkPeriphery.sol";

contract ZkLinkPeripheryTest is ZkLinkPeriphery {

    function testCollectOnchainOps(CommitBlockInfo memory _newBlockData) external view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes memory offsetsCommitment,
        bytes[] memory onchainOperationPubdatas
    ) {
        return collectOnchainOps(_newBlockData);
    }
}
