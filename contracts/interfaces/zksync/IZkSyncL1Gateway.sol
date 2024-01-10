// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IL1Gateway} from "../IL1Gateway.sol";

interface IZkSyncL1Gateway is IL1Gateway {
    /// @notice Finalize the message sent from ZkSyncL2Gateway
    /// @param _l2BatchNumber The L2 batch number where the message was processed
    /// @param _l2MessageIndex The position in the L2 logs Merkle tree of the l2Log that was sent with the message
    /// @param _l2TxNumberInBatch The L2 transaction number in the batch, in which the log was sent
    /// @param _message The L2 withdraw data, stored in an L2 -> L1 message
    /// @param _merkleProof The Merkle proof of the inclusion L2 -> L1 message about withdrawal initialization
    function finalizeMessage(uint256 _l2BatchNumber, uint256 _l2MessageIndex, uint16 _l2TxNumberInBatch, bytes calldata _message, bytes32[] calldata _merkleProof) external;
}
