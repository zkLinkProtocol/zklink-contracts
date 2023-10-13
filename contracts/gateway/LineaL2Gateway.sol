// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {ILineaL1Gateway} from "../interfaces/ILineaL1Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {IUSDCBridge} from "../interfaces/linea/IUSDCBridge.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";


contract LineaL2Gateway is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, ILineaL2Gateway {
    using SafeERC20 for IERC20;

    /// @dev Address represent eth when deposit or withdraw
    address internal constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

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

    modifier onlyZkLink() {
        require(msg.sender == address(zkLinkContract), "Not zklink contract");
        _;
    }

    function initialize(IMessageService _messageService, IZkLink _zkLinkContract, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        messageService = _messageService;
        zkLinkContract = _zkLinkContract;
        tokenBridge = _tokenBridge;
        usdcBridge = _usdcBridge;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev ETH is transferred from LineaL1Gateway to LineaL2Gateway and then deposit to zkLink for user
    function claimDepositETH(uint256 _value, bytes calldata _callData, uint256 _nonce) external override nonReentrant whenNotPaused {
        // no fee on origin chain
        messageService.claimMessage(remoteGateway, address(this), 0, _value, payable(msg.sender), _callData, _nonce);
    }

    function claimDepositETHCallback(bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable onlyMessageService onlyRemoteGateway {
        require(msg.value == _amount, "claim eth value not match");

        zkLinkContract.depositETH{value: _amount}(_zkLinkAddress, _subAccountId);
        emit ClaimedDepositETH(_zkLinkAddress, _subAccountId, _amount);
    }

    /// @dev ERC20 token is transferred from LineaL1Gateway to LineaL2Gateway and then deposit to zkLink for user
    function claimDepositERC20(address _remoteBridge, address _bridge, bytes calldata _bridgeCallData, uint256 _bridgeNonce, bytes calldata _cbCallData, uint256 _cbNonce) external override nonReentrant whenNotPaused {
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

    /// @notice Withdraw ETH to L1 for owner
    /// @param _owner The address received eth on L1
    /// @param _amount The eth amount received
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function withdrawETH(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink {
        require(msg.value == _amount + messageService.minimumFeeInWei(), "Invalid fee");

        bytes memory callData = abi.encodeCall(ILineaL1Gateway.claimWithdrawETHCallback, (_owner, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate));
        messageService.sendMessage{value: msg.value}(address(remoteGateway), 0, callData);
    }

    /// @notice Withdraw ERC20 token to L1 for owner
    /// @dev gateway need to pay fee to message service
    /// @param _owner The address received token on L1
    /// @param _token The token address on L2
    /// @param _amount The token amount received
    /// @param _accountIdOfNonce Account that supply nonce, may be different from accountId
    /// @param _subAccountIdOfNonce SubAccount that supply nonce
    /// @param _nonce SubAccount nonce, used to produce unique accept info
    /// @param _fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    function withdrawERC20(address _owner, address _token, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink {
        uint256 coinbaseFee = messageService.minimumFeeInWei();
        require(msg.value == coinbaseFee * 2, "Invalid fee");

        // transfer token from sender to LineaL1Gateway
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // approve bridge
        // bridge token to remoteGateway(the first message send to Linea)
        // find the native token
        bool isUSDC;
        address nativeToken;
        if (_token == usdcBridge.usdc()) {
            IERC20(_token).safeApprove(address(usdcBridge), _amount);
            usdcBridge.depositTo{value: coinbaseFee}(_amount, remoteGateway);
            isUSDC = true;
            nativeToken = _token;
        } else {
            IERC20(_token).safeApprove(address(tokenBridge), _amount);
            tokenBridge.bridgeToken{value: coinbaseFee}(_token, _amount, remoteGateway);
            isUSDC = false;
            nativeToken = tokenBridge.bridgedToNativeToken(_token);
            if (nativeToken == address(0)) {
                nativeToken = _token;
            }
        }

        // send depositERC20 command to LineaL2Gateway(the second message send to Linea)
        bytes memory executeData = abi.encodeCall(
            ILineaL1Gateway.claimWithdrawERC20Callback,
            (isUSDC, nativeToken, _owner, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate)
        );
        messageService.sendMessage{value: coinbaseFee}(remoteGateway, 0, executeData);
    }

    /// @notice Set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        remoteGateway = _remoteGateway;
        emit SetRemoteGateway(_remoteGateway);
    }

    /// @dev Pause the contract, can only be called by the owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @dev Unpause the contract, can only be called by the owner
    function unpause() external onlyOwner {
        _unpause();
    }
}
