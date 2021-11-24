// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../zksync/SafeCast.sol";
import "../ZkSyncBlock.sol";

contract ZkSyncBlockTest is ZkSyncBlock {

    function testBlockCommitment(
        StoredBlockInfo memory _previousBlock,
        CommitBlockInfo memory _newBlockData,
        bytes memory _offsetCommitment
    ) external view returns (bytes32 commitment) {
        return createBlockCommitment(_previousBlock, _newBlockData, _offsetCommitment);
    }

    function testExecQuickSwap(bytes calldata _pubdata) external {
        execQuickSwap(_pubdata);
    }

    function testExecMappingToken(bytes calldata _pubdata) external {
        execMappingToken(_pubdata);
    }

    function testExecL1AddLQ(bytes calldata _pubdata) external {
        execL1AddLQ(_pubdata);
    }

    function testExecL1RemoveLQ(bytes calldata _pubdata) external {
        execL1RemoveLQ(_pubdata);
    }

    function testExecPartialExit(bytes calldata _pubdata) external {
        execPartialExit(_pubdata);
    }
}
