// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface ITokenBridge {
    /**
     * @notice Similar to `bridgeToken` function but allows to pass additional
     *   permit data to do the ERC20 approval in a single transaction.
     * @param _token The address of the token to be bridged.
     * @param _amount The amount of the token to be bridged.
     * @param _recipient The address that will receive the tokens on the other chain.
     * @param _permitData The permit data for the token, if applicable.
     */
    function bridgeTokenWithPermit(
        address _token,
        uint256 _amount,
        address _recipient,
        bytes calldata _permitData
    ) external payable;

    function bridgeToken(address _token, uint256 _amount, address _recipient) external payable;

    /**
     * @dev It can only be called from the Message Service. To finalize the bridging
     *   process, a user or postmen needs to use the `claimMessage` function of the
     *   Message Service to trigger the transaction.
     * @param _nativeToken The address of the token on its native chain.
     * @param _amount The amount of the token to be received.
     * @param _recipient The address that will receive the tokens.
     * @param _tokenMetadata Additional data used to deploy the bridged token if it
     *   doesn't exist already.
     */
    function completeBridging(
        address _nativeToken,
        uint256 _amount,
        address _recipient,
        bytes calldata _tokenMetadata
    ) external;

    function remoteSender() external view returns (address);

    function nativeToBridgedToken(address token) external view returns (address);

    function bridgedToNativeToken(address token) external view returns (address);
}
