// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IZKSyncGateway {
    error OnlyRemoteGateway();
    error InvalidParmas();

    event DepositETH(
        address sender,
        bytes32 zklinkAddress,
        uint8 subAccountId,
        uint256 value
    );
    event DepositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    );

    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    ) external payable;

    function depositETH(
        bytes32 _zkLinkAddress,
        uint8 _subAccountId
    ) external payable;
}
