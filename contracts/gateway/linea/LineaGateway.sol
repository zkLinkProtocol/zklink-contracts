// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMessageService} from "../../interfaces/linea/IMessageService.sol";
import {IUSDCBridge} from "../../interfaces/linea/IUSDCBridge.sol";
import {ITokenBridge} from "../../interfaces/linea/ITokenBridge.sol";

import {ILineaGateway} from "../../interfaces/linea/ILineaGateway.sol";
import {BaseGateway} from "../BaseGateway.sol";

abstract contract LineaGateway is BaseGateway, ILineaGateway {
    using SafeERC20 for IERC20;

    /// @notice Linea message service on local chain
    IMessageService public messageService;

    /// @notice Linea token bridge on local chain
    ITokenBridge public tokenBridge;

    /// @notice Linea USDC bridge on local chain
    IUSDCBridge public usdcBridge;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[47] private __gap;

    /// @dev Modifier to make sure the caller is the known message service.
    modifier onlyMessageService() {
        require(msg.sender == address(messageService), "Not message service");
        _;
    }

    /// @dev Modifier to make sure the original sender is gateway on remote chain.
    modifier onlyRemoteGateway() {
        require(messageService.sender() == remoteGateway, "Not remote gateway");
        _;
    }

    function __LineaGateway_init(IMessageService _messageService, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) internal onlyInitializing {
        __BaseGateway_init();
        __LineaGateway_init_unchained(_messageService, _tokenBridge, _usdcBridge);
    }

    function __LineaGateway_init_unchained(IMessageService _messageService, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) internal onlyInitializing {
        messageService = _messageService;
        tokenBridge = _tokenBridge;
        usdcBridge = _usdcBridge;
    }

    function claimMessage(bytes calldata _callData, uint256 _nonce) external nonReentrant whenNotPaused {
        // no fee and no value on remote chain
        _claimMessage(0, 0, _callData, _nonce);
    }

    function claimETH(uint256 _value, bytes calldata _callData, uint256 _nonce) external override nonReentrant whenNotPaused {
        // no fee on remote chain
        _claimMessage(0, _value, _callData, _nonce);
    }

    function claimERC20(address _remoteBridge, address _bridge, bytes calldata _bridgeCallData, uint256 _bridgeNonce, bytes calldata _cbCallData, uint256 _cbNonce) external override nonReentrant whenNotPaused {
        // the message service on remote chain will generate two consecutive nonce messages.
        require(_cbNonce == _bridgeNonce + 1, "Claim erc20 message nonce is not continuous");

        // claim token from token bridge to gateway
        // no value and no fee on remote chain
        messageService.claimMessage(_remoteBridge, _bridge, 0, 0, payable(msg.sender), _bridgeCallData, _bridgeNonce);

        // execute command
        // no value and no fee on remote chain
        _claimMessage(0, 0, _cbCallData, _cbNonce);
    }

    /// @dev Claim message from remote gateway
    function _claimMessage(uint _fee, uint _value, bytes calldata _callData, uint256 _nonce) internal {
        messageService.claimMessage(remoteGateway, address(this), _fee, _value, payable(msg.sender), _callData, _nonce);
    }

    /// @dev Bridge token to remote gateway
    /// @param _token The token on local chain
    /// @param _amount The token amount
    /// @param _fee The fee payed to message service
    /// @return Return native token and whether it is USDC
    function bridgeERC20ToRemoteGateway(address _token, uint256 _amount, uint256 _fee) internal returns (bool, address) {
        bool isUSDC;
        address nativeToken;
        // approve bridge
        // bridge token to remoteGateway
        // find the native token
        if (_token == usdcBridge.usdc()) {
            IERC20(_token).safeApprove(address(usdcBridge), _amount);
            usdcBridge.depositTo{value: _fee}(_amount, remoteGateway);
            isUSDC = true;
            nativeToken = _token;
        } else {
            IERC20(_token).safeApprove(address(tokenBridge), _amount);
            tokenBridge.bridgeToken{value: _fee}(_token, _amount, remoteGateway);
            isUSDC = false;
            nativeToken = tokenBridge.bridgedToNativeToken(_token);
            if (nativeToken == address(0)) {
                nativeToken = _token;
            }
        }
        return (isUSDC, nativeToken);
    }

    /// @dev Get target token on local chain
    /// @param _nativeToken The native token
    function getTargetToken(bool _isUSDC, address _nativeToken) internal view returns (address) {
        address targetToken;
        if (_isUSDC) {
            targetToken = usdcBridge.usdc();
        } else {
            // check token if a native token on remote chain
            address bridgedToken = tokenBridge.nativeToBridgedToken(tokenBridge.targetChainId(), _nativeToken);
            if (bridgedToken != address(0)) {
                // token is a native token on remote chain, return the bridged token
                targetToken = bridgedToken;
            } else {
                // token is a native token on local chain, return it
                targetToken = _nativeToken;
            }
        }
        return targetToken;
    }
}
