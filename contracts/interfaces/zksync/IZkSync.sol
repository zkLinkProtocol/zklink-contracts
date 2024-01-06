// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @author Matter Labs
interface IZkSync {
    /// @dev An arbitrary length message passed from L2
    /// @notice Under the hood it is `L2Log` sent from the special system L2 contract
    /// @param txNumberInBatch The L2 transaction number in the batch, in which the message was sent
    /// @param sender The address of the L2 account from which the message was passed
    /// @param data An arbitrary length message
    struct L2Message {
        uint16 txNumberInBatch;
        address sender;
        bytes data;
    }

    function requestL2Transaction(
        address _contractL2,
        uint256 _l2Value,
        bytes calldata _calldata,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit,
        bytes[] calldata _factoryDeps,
        address _refundRecipient
    ) external payable returns (bytes32 canonicalTxHash);

    function l2TransactionBaseCost(
        uint256 _gasPrice,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit
    ) external view returns (uint256);

    function proveL2MessageInclusion(
        uint256 _l2BatchNumber,
        uint256 _index,
        L2Message calldata _message,
        bytes32[] calldata _proof
    ) external view returns (bool);
}
