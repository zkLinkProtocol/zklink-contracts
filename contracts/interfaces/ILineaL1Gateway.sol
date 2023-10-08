// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface ILineaL1Gateway {
    event Deposit(
        address token,
        uint104 amount,
        bytes32 zklinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bytes _calldata,
        uint256 nonce,
        bytes _cbCalldata,
        bytes32 messageHash,
        uint192 txNonce
    );
    event SetFee(uint64 fee);
    event SetBridge(address token, address bridge);
    event SetRemoteBridge(address token, address remoteBridge);
    event SetRemoteToken(address token, address remoteToken);

    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable;

    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;
}
