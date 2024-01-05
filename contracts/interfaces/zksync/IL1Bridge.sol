// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @author Matter Labs
interface IL1Bridge {
    function deposit(
        address _l2Receiver,
        address _l1Token,
        uint256 _amount,
        uint256 _l2TxGasLimit,
        uint256 _l2TxGasPerPubdataByte,
        address _refundRecipient
    ) external payable returns (bytes32 txHash);
}
