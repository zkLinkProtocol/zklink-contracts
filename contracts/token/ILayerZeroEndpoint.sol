// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILayerZeroEndpoint {
    /// @notice the send() method which sends a bytes payload to a another chain
    /// @param _chainId the destination chainId
    /// @param _destination the destination contract address
    /// @param _payload the raw bytes of your payload
    /// @param _refundAddress where additional destination gas is refunded
    /// @param _zroPaymentAddress address(0x0) for now
    /// @param _txParameters bytes("") for now
    function send(uint16 _chainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _txParameters) external payable;

    /// @notice estimate the fees send() need
    /// @param _chainId the destination chainId
    /// @param _userApplication the user application use layerzero
    /// @param _payload the raw bytes of your payload
    /// @param _payInZRO if fee pay in ZRO token
    /// @param _txParameters bytes("") for now
    function estimateNativeFees(uint16 _chainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _txParameters) view external returns (uint totalFee);
}
