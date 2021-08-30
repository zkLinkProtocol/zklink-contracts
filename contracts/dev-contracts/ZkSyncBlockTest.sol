// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../SafeCast.sol";
import "../ZkSyncBlock.sol";

contract ZkSyncBlockTest is ZkSyncBlock {

    function testBlockCommitment(
        StoredBlockInfo memory _previousBlock,
        CommitBlockInfo memory _newBlockData,
        bytes memory _offsetCommitment
    ) external view returns (bytes32 commitment) {
        return createBlockCommitment(_previousBlock, _newBlockData, _offsetCommitment);
    }

    function testAccepterWithdraw(bytes calldata _pubdata) external {
        Operations.QuickSwap memory op = Operations.readQuickSwapPubdata(_pubdata);
        accepterWithdraw(op);
    }
}
