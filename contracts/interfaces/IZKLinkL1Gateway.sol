// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IZKLinkL1Gateway {
    enum Chains {
        Linea,
        ZKSync
    }
    event DepositERC20(
        address token,
        uint104 amount,
        bytes32 zklinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bytes _calldata,
        uint256 nonce,
        bytes32 messageHash
    );

    event DepositETH(
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        uint104 amount
    );
    event SetFeeOn(bool feeOn);
    event SetBridge(address token, address bridge);
    event SetRemoteBridge(address token, address remoteBridge);
    event SetRemoteToken(address token, address remoteToken);

    error InvalidFee();
    error InvalidParmas();
    error TokenNotSupport();
    error NotReceiveETHDirectly();
    error NoRemoteTokenSet();

    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    ) external payable; // fee 填 0.001 ether

    function depositETH(
        bytes32 _zkLinkAddress,
        uint8 _subAccountId
    ) external payable;

    /***********************************************
     * ZKSync
     ***********************************************/
    event DepositETH(
        bytes32 zklinkAddress,
        uint8 subAccountId,
        uint256 amount,
        bytes32 txhash
    );
    event DepositZksyncERC20(
        address token,
        uint104 amount,
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bytes32 txhash
    );

    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes calldata _extendParams
    ) external payable;
}
