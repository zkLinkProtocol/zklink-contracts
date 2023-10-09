// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface ILineaL2Gateway {
    event ClaimedDepositETH(bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount);
    event ClaimedDepositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping);
    event SetRemoteGateway(address remoteGateWay);

    /// @notice Claim deposit ETH message
    /// @param _value The value to be transferred to the LineaL2Gateway from L1
    /// @param _callData The `claimDepositETHCallback` encoded call data
    /// @param _nonce The execute depositETH message number
    function claimDepositETH(uint256 _value, bytes calldata _callData, uint256 _nonce) external;

    /// @notice Claim deposit ETH callback from message service
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _amount The eth amount to deposit
    function claimDepositETHCallback(bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable;

    /// @notice Claim deposit ERC20 message
    /// @param _remoteBridge The token bridge address on L1
    /// @param _bridge The token bridge address on Linea
    /// @param _bridgeCallData Then token bridge call data
    /// @param _bridgeNonce The token bridge message number
    /// @param _cbCallData The `claimDepositERC20Callback` encoded call data
    /// @param _cbNonce The execute depositERC20 message number
    function claimDepositERC20(address _remoteBridge, address _bridge, bytes calldata _bridgeCallData, uint256 _bridgeNonce, bytes calldata _cbCallData, uint256 _cbNonce) external;

    /// @notice Claim deposit ERC20 callback from message service
    /// @param _isUSDC True when the native token is usdc
    /// @param _nativeToken The native token
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function claimDepositERC20Callback(bool _isUSDC, address _nativeToken, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external;
}
