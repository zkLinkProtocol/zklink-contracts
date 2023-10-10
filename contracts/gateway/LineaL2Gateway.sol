// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {IUSDCBridge} from "../interfaces/linea/IUSDCBridge.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";

contract LineaL2Gateway is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, ILineaL2Gateway {
    using SafeERC20 for IERC20;

    /// @notice Linea message service address on Linea
    IMessageService public messageService;

    /// @notice Remote Gateway address on L1
    address public remoteGateway;

    /// @notice zkLink contract on Linea
    IZkLink public zkLinkContract;

    /// @notice Linea token bridge on Linea
    ITokenBridge public tokenBridge;

    /// @notice Linea USDC bridge on Linea
    IUSDCBridge public usdcBridge;

    /// @dev Modifier to make sure the caller is the known message service.
    modifier onlyMessageService() {
        require(msg.sender == address(messageService), "Not message service");
        _;
    }

    /// @dev Modifier to make sure the original sender is LineaL1Gateway.
    modifier onlyRemoteGateway() {
        require(messageService.sender() == remoteGateway, "Not remote gateway");
        _;
    }

    function initialize(IMessageService _messageService, IZkLink _zkLinkContract, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        messageService = _messageService;
        zkLinkContract = _zkLinkContract;
        tokenBridge = _tokenBridge;
        usdcBridge = _usdcBridge;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev ETH is transferred from LineaL1Gateway to LineaL2Gateway and then deposit to zkLink for user
    function claimDepositETH(uint256 _value, bytes calldata _callData, uint256 _nonce) external override nonReentrant {
        // no fee on origin chain
        messageService.claimMessage(remoteGateway, address(this), 0, _value, payable(msg.sender), _callData, _nonce);
    }

    function claimDepositETHCallback(bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable onlyMessageService onlyRemoteGateway {
        require(msg.value == _amount, "claim eth value not match");

        zkLinkContract.depositETH{value: _amount}(_zkLinkAddress, _subAccountId);
        emit ClaimedDepositETH(_zkLinkAddress, _subAccountId, _amount);
    }

    /// @dev ERC20 token is transferred from LineaL1Gateway to LineaL2Gateway and then deposit to zkLink for user
    function claimDepositERC20(address _remoteBridge, address _bridge, bytes calldata _bridgeCallData, uint256 _bridgeNonce, bytes calldata _cbCallData, uint256 _cbNonce) external override nonReentrant {
        // when depositERC20 of LineaL1Gateway is called, the message service on L1 will generate two consecutive nonce messages.
        require(_cbNonce == _bridgeNonce + 1, "Claim erc20 message nonce is not continuous");

        // claim token from token bridge on Linea to LineaL2Gateway
        // no value and no fee on origin chain
        messageService.claimMessage(_remoteBridge, _bridge, 0, 0, payable(msg.sender), _bridgeCallData, _bridgeNonce);

        // execute depositERC20 command
        // no value and no fee on origin chain
        messageService.claimMessage(remoteGateway, address(this), 0, 0, payable(msg.sender), _cbCallData, _cbNonce);
    }

    function claimDepositERC20Callback(bool _isUSDC, address _nativeToken, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external override onlyMessageService onlyRemoteGateway {
        // find target token on Linea
        address targetToken;
        if (_isUSDC) {
            targetToken = usdcBridge.usdc();
        } else {
            // check token if a native token on L1
            address bridgedToken = tokenBridge.nativeToBridgedToken(tokenBridge.targetChainId(), _nativeToken);
            if (bridgedToken != address(0)) {
                // token is a native token on L1, then use the bridged token
                targetToken = bridgedToken;
            } else {
                // token is a native token on Linea, then use the token
                targetToken = _nativeToken;
            }
        }
        // approve token to zkLink
        IERC20(targetToken).safeApprove(address(zkLinkContract), _amount);
        // deposit erc20 to zkLink
        zkLinkContract.depositERC20(IERC20(targetToken), uint104(_amount), _zkLinkAddress, _subAccountId, _mapping);
        emit ClaimedDepositERC20(targetToken, _amount, _zkLinkAddress, _subAccountId, _mapping);
    }

    /// @notice Set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        remoteGateway = _remoteGateway;
        emit SetRemoteGateway(_remoteGateway);
    }
}
