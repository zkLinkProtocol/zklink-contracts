// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface ILineaGateway {
    /// @notice Claim ETH message
    /// @param _value The value to be transferred to the gateway on local chain from remote chain
    /// @param _callData The `claimETHCallback` encoded call data
    /// @param _nonce The bridge eth message number of Linea message service on local chain
    function claimETH(uint256 _value, bytes calldata _callData, uint256 _nonce) external;

    /// @notice Claim ERC20 message
    /// @param _remoteBridge The token bridge address on remote chain
    /// @param _bridge The token bridge address on local chain
    /// @param _bridgeCallData Then token bridge call data
    /// @param _bridgeNonce The bridge token message number of Linea message service on local chain
    /// @param _cbCallData The `claimERC20Callback` encoded call data
    /// @param _cbNonce The execute message number of Linea message service on local chain
    function claimERC20(address _remoteBridge, address _bridge, bytes calldata _bridgeCallData, uint256 _bridgeNonce, bytes calldata _cbCallData, uint256 _cbNonce) external;
}
