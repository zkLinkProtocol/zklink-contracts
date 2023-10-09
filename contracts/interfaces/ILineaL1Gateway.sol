// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface ILineaL1Gateway {
    event Deposit(uint192 indexed txNonce, address token, uint256 amount, bytes32 zklinkAddress, uint8 subAccountId, bool _mapping);
    event SetFee(uint64 fee);
    event SetRemoteGateway(address remoteGateWay);
    event WithdrawFee(address receiver, uint256 amount);

    /// @notice Deposit ETH to zkLink on Linea
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;

    /// @notice Deposit ERC20 to zkLink on Linea
    /// @param _token The token on L1
    /// @param _amount The amount to deposit
    /// @param _zkLinkAddress The zkLink address deposited to
    /// @param _subAccountId The sub account id
    /// @param _mapping If receive a mapping token on zkLink
    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable;
}
