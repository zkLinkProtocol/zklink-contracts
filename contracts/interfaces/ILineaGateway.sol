// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface ILineaGateway {
    event ClaimedDepositERC20(
        address token,
        uint104 amount,
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bool success,
        bytes errorInfo
    );

    event ClaimedDepositETH(
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        uint104 amount,
        bool success,
        bytes erroInfo
    );
    event SetBridge(address token, address bridge);
    event SetRemoteBridge(address token, address remoteBridge);
    event SetRemoteToken(address token, address remoteToken);

    error OnlyMessageService();
    error InvalidValue();
    error InvalidParmas();
    error NoRemoteTokenSet();
    error UnknowMessage();
    error CanNotClaimTwice();

    function claimDepositERC20(
        address token,
        bytes calldata _calldata,
        uint256 nonce,
        bytes calldata cbCalldata,
        uint256 cbNonce
    ) external;

    function claimDepositETH(
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        uint104 amount
    ) external payable;

    function claimDepositERC20Callback(
        address token,
        uint104 amount,
        bytes32 zkLinkAddress,
        uint8 subAccountId,
        bool _mapping,
        bytes32 messageHash
    ) external;
}
