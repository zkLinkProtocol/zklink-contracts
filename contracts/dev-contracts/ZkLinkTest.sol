// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkLink.sol";

contract ZkLinkTest is ZkLink {

    function setExodus(bool _exodusMode) external {
        exodusMode = _exodusMode;
    }

    function getPriorityHash(uint64 index) external view returns (bytes20) {
        return priorityRequests[index].hashedPubData;
    }

    function mockExecBlock(StoredBlockInfo memory storedBlockInfo) external {
        storedBlockHashes[storedBlockInfo.blockNumber] = hashStoredBlockInfo(storedBlockInfo);
        totalBlocksExecuted = storedBlockInfo.blockNumber;
    }

    function testAddPriorityRequest(Operations.OpType _opType, bytes memory _pubData) external {
        addPriorityRequest(_opType, _pubData);
    }

    function testCommitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock, bool _compressed, CompressedBlockExtraInfo memory _newBlockExtra) external view returns (StoredBlockInfo memory storedNewBlock) {
        return commitOneBlock(_previousBlock, _newBlock, _compressed, _newBlockExtra);
    }

    function testCollectOnchainOps(CommitBlockInfo memory _newBlockData) external view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes memory offsetsCommitment,
        bytes32[] memory onchainOperationPubdataHashs
    ) {
        return collectOnchainOps(_newBlockData);
    }

    function testExecuteWithdraw(Operations.Withdraw memory op) external {
        executeWithdraw(op);
    }
}
