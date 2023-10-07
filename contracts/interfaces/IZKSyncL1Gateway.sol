// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IZKSyncL1Gateway {
    error InvalidFee();
    error InvalidParmas();

    event SetFeeOn(bool feeOn, uint64 fee);
    event DepositETH(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, bytes32 txhash, uint184 txNonce);
    event DepositERC20(address token, uint104 amount, bytes32 zkLinkAddress, uint8 subAccountId, bool _mapping, bytes32 txhash, uint184 txNonce);

    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping, bytes calldata _extendParams) external payable;

    function depositETH(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, uint256 l2GasLimit, uint256 baseCost) external payable;
}
