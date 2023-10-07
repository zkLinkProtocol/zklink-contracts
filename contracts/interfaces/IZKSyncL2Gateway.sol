// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IZKSyncL2Gateway {
    error OnlyRemoteGateway();
    error InvalidParmas();

    event DepositETH(address sender, bytes32 zklinkAddress, uint8 subAccountId, uint256 value);
    event DepositERC20(address token, uint104 amount, bytes32 zkLinkAddress, uint8 subAccountId, bool _mapping);
    event ClaimedDepositETH(bytes32 zkLinkAddress, uint8 subAccountId, uint256 amount);
    event ClaimedDepositERC20(address token, uint104 amount, bytes32 zkLinkAddress, uint8 subAccountId, bool _mapping);

    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external;

    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;
}
