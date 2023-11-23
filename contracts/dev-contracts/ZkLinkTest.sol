// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../ZkLink.sol";

contract ZkLinkTest is ZkLink {

    constructor(address _periphery) ZkLink(_periphery) {}

    receive() external payable {
    }

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
        if (_opType == Operations.OpType.Deposit) {
            addPriorityRequest(_opType, _pubData, Operations.DEPOSIT_CHECK_BYTES);
        } else if (_opType == Operations.OpType.FullExit) {
            addPriorityRequest(_opType, _pubData, Operations.FULL_EXIT_CHECK_BYTES);
        }
    }

    // #if CHAIN_ID == MASTER_CHAIN_ID
    function testCommitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock) external view returns (StoredBlockInfo memory storedNewBlock) {
        return commitOneBlock(_previousBlock, _newBlock);
    }

    function testCollectOnchainOps(CommitBlockInfo memory _newBlockData) external view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes memory offsetsCommitment,
        uint256 slaverChainNum,
        bytes32[] memory onchainOperationPubdataHashs
    ) {
        return collectOnchainOps(_newBlockData);
    }
    // #endif

    // #if CHAIN_ID != MASTER_CHAIN_ID
    function testCommitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock) external view returns (StoredBlockInfo memory storedNewBlock) {
        return commitOneCompressedBlock(_previousBlock, _newBlock);
    }

    function testCollectOnchainOps(CommitBlockInfo memory _newBlockData) external view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes32 onchainOperationPubdataHash
    ) {
        return collectOnchainOpsOfCompressedBlock(_newBlockData);
    }
    // #endif

    function testExecuteWithdraw(Operations.Withdraw memory op) external {
        _executeWithdraw(op.accountId, op.subAccountId, op.nonce, op.owner, op.tokenId, op.amount, op.fastWithdrawFeeRate, op.withdrawToL1);
    }

    function testVerifyChangePubkey(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) external pure returns (bool) {
        return verifyChangePubkey(_ethWitness, _changePk);
    }
}
