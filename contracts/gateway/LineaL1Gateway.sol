// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IUSDCBridge} from "../interfaces/linea/IUSDCBridge.sol";
import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {ILineaL1Gateway} from "../interfaces/ILineaL1Gateway.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";

contract LineaL1Gateway is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, ILineaL1Gateway {
    using SafeERC20 for IERC20;

    /// @dev Address represent eth when deposit or withdraw
    address internal constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice L2 claim message gas fee users should pay for
    uint64 public fee;

    /// @notice Used to prevent off-chain monitoring events from being lost
    uint192 public txNonce;

    /// @notice Linea message service on L1
    IMessageService public messageService;

    /// @notice Remote Gateway address on Linea
    address public remoteGateway;

    /// @notice Linea token bridge on L1
    ITokenBridge public tokenBridge;

    /// @notice Linea USDC bridge on L1
    IUSDCBridge public usdcBridge;

    function initialize(IMessageService _messageService, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        messageService = _messageService;
        tokenBridge = _tokenBridge;
        usdcBridge = _usdcBridge;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override nonReentrant {
        // ensure amount bridged is not zero
        require(msg.value > fee, "msg value too low");
        uint256 amount = msg.value - fee;

        bytes memory callData = abi.encodeCall(ILineaL2Gateway.claimDepositETHCallback, (_zkLinkAddress, _subAccountId, amount));
        // transfer no fee to Linea
        messageService.sendMessage{value: amount}(remoteGateway, 0, callData);

        emit Deposit(txNonce, ETH_ADDRESS, amount, _zkLinkAddress, _subAccountId, false);
        txNonce++;
    }

    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override nonReentrant {
        require(msg.value == fee, "invalid msg value");
        require(_amount > 0, "invalid token amount");

        // transfer token from sender to LineaL1Gateway
        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // approve bridge
        // bridge token to remoteGateway(the first message send to Linea)
        // find the native token
        bool isUSDC;
        address nativeToken;
        if (_token == usdcBridge.usdc()) {
            IERC20(_token).safeApprove(address(usdcBridge), _amount);
            usdcBridge.depositTo(_amount, remoteGateway);
            isUSDC = true;
            nativeToken = _token;
        } else {
            IERC20(_token).safeApprove(address(tokenBridge), _amount);
            tokenBridge.bridgeToken(_token, _amount, remoteGateway);
            isUSDC = false;
            nativeToken = tokenBridge.bridgedToNativeToken(_token);
            if (nativeToken == address(0)) {
                nativeToken = _token;
            }
        }

        // only support pure erc20 token
        uint256 balanceAfter = IERC20(_token).balanceOf(address(this));
        require(balanceAfter == balanceBefore, "only support pure erc20 token");

        // send depositERC20 command to LineaL2Gateway(the second message send to Linea)
        bytes memory executeData = abi.encodeCall(
            ILineaL2Gateway.claimDepositERC20Callback,
            (isUSDC, nativeToken, _amount, _zkLinkAddress, _subAccountId, _mapping)
        );
        messageService.sendMessage(remoteGateway, 0, executeData);

        emit Deposit(txNonce, _token, _amount, _zkLinkAddress, _subAccountId, _mapping);
        txNonce++;
    }

    /// @notice Set deposit fee
    function setFee(uint64 _fee) external onlyOwner {
        fee = _fee;
        emit SetFee(_fee);
    }

    /// @notice Set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        remoteGateway = _remoteGateway;
        emit SetRemoteGateway(_remoteGateway);
    }

    /// @notice Withdraw fees
    /// @param _receiver The receiver address
    /// @param _amount The withdraw amount
    function withdrawFee(address payable _receiver, uint256 _amount) external onlyOwner {
        (bool success, ) = _receiver.call{value: _amount}("");
        require(success, "withdraw fee failed");

        emit WithdrawFee(_receiver, _amount);
    }
}
