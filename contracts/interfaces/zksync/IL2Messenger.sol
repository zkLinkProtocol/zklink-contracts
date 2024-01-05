// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @author Matter Labs
interface IL2Messenger {
    function sendToL1(bytes memory _message) external returns (bytes32);
}
