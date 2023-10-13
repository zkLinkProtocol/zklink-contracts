// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

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
        _executeWithdraw(op.accountId, op.subAccountId, op.nonce, op.owner, op.tokenId, op.amount, op.fastWithdrawFeeRate, op.withdrawToL1);
    }

    function testVerifyChangePubkeyECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) external pure returns (bool) {
        return verifyChangePubkeyECRECOVER(_ethWitness, _changePk);
    }
}
