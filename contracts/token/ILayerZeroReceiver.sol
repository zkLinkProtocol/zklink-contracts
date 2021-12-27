// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILayerZeroReceiver {
    /// @notice the method which your contract needs to implement to receive messages
    /// @param _srcChainId the source chainId
    /// @param _srcAddress the source contract address
    /// @param _nonce receive message nonce
    /// @param _payload receive message payload
    function lzReceive(uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload) external;
}
