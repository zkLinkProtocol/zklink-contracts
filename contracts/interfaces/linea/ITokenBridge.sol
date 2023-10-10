// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface ITokenBridge {
    /// @notice mapping (chainId => nativeTokenAddress => bridgedTokenAddress)
    function nativeToBridgedToken(uint256 chainId, address token) external view returns (address);

    /// @notice mapping (bridgedTokenAddress => nativeTokenAddress)
    function bridgedToNativeToken(address token) external view returns (address);

    /// @notice The current layer chainId from where the bridging is triggered
    function sourceChainId() external view returns (uint256);

    /// @notice The targeted layer chainId where the bridging is received
    function targetChainId() external view returns (uint256);

    /**
   * @notice This function is the single entry point to bridge tokens to the
   *   other chain, both for native and already bridged tokens. You can use it
   *   to bridge any ERC20. If the token is bridged for the first time an ERC20
   *   (BridgedToken.sol) will be automatically deployed on the target chain.
   * @dev User should first allow the bridge to transfer tokens on his behalf.
   *   Alternatively, you can use BridgeTokenWithPermit to do so in a single
   *   transaction. If you want the transfer to be automatically executed on the
   *   destination chain. You should send enough ETH to pay the postman fees.
   *   Note that Linea can reserve some tokens (which use a dedicated bridge).
   *   In this case, the token cannot be bridged. Linea can only reserve tokens
   *   that have not been bridged yet.
   *   Linea can pause the bridge for security reason. In this case new bridge
   *   transaction would revert.
   * @param _token The address of the token to be bridged.
   * @param _amount The amount of the token to be bridged.
   * @param _recipient The address that will receive the tokens on the other chain.
   */
    function bridgeToken(address _token, uint256 _amount, address _recipient) external payable;
}
