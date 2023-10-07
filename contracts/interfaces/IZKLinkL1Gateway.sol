// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

interface IZKLinkL1Gateway {
    enum Chains {
        Linea,
        ZKSync
    }
    event DepositLineaERC20(
        address token,
        uint104 amount,
        bytes32 zklinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bytes _calldata,
        uint256 nonce,
        bytes32 messageHash,
        uint120 txNonce
    );

    event DepositLineaETH(bytes32 _zkLinkAddress, uint8 _subAccountId, uint104 amount, uint120 txNonce);
    event SetFeeOn(Chains chain, bool feeOn, uint64 fee);
    event SetBridge(address token, address bridge);
    event SetRemoteBridge(address token, address remoteBridge);
    event SetRemoteToken(address token, address remoteToken);

    error InvalidFee();
    error InvalidParmas();
    error TokenNotSupport();
    error NotReceiveETHDirectly();
    error NoRemoteTokenSet();

    function depositERC20ByLinea(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable;

    function depositETHByLinea(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable;

    /***********************************************
     * ZKSync
     ***********************************************/
    event DepositZKSyncETH(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, bytes32 txhash, uint120 txNonce);
    event DepositZksyncERC20(address token, uint104 amount, bytes32 zkLinkAddress, uint8 subAccountId, bool _mapping, bytes32 txhash, uint120 txNonce);

    function depositERC20ByZksync(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping, bytes calldata _extendParams) external payable;

    function depositETHByZksync(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, uint256 l2GasLimit, uint256 baseCost) external payable;
}
