// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IL2Gateway} from "../interfaces/IL2Gateway.sol";
import {ILineaL1Gateway} from "../interfaces/ILineaL1Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {IUSDCBridge} from "../interfaces/linea/IUSDCBridge.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";
import {LineaGateway} from "./LineaGateway.sol";
import {L1BaseGateway} from "./L1BaseGateway.sol";

contract LineaL1Gateway is L1BaseGateway, LineaGateway, ILineaL1Gateway {
    using SafeERC20 for IERC20;

    /// @notice L2 claim message gas fee users should pay for
    uint64 public fee;

    /// @notice Used to prevent off-chain monitoring events from being lost
    uint32 public txNonce;

    event Deposit(uint32 indexed txNonce, address token, uint256 amount, bytes32 zklinkAddress, uint8 subAccountId, bool _mapping);
    event ClaimedWithdrawETH(address _receiver, uint256 _amount);
    event ClaimedWithdrawERC20(address _receiver, address _token, uint256 _amount);
    event SetFee(uint64 fee);
    event WithdrawFee(address receiver, uint256 amount);

    function initialize(IMessageService _messageService, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) external initializer {
        __LineaGateway_init(_messageService, _tokenBridge, _usdcBridge);
    }

    function depositETH(uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override nonReentrant whenNotPaused {
        // ensure amount bridged is not zero
        require(_amount > 0, "Invalid eth amount");
        require(msg.value == _amount + fee, "Invalid msg value");

        uint32 _txNonce = txNonce;
        bytes memory callData = abi.encodeCall(ILineaL2Gateway.claimETHCallback, (_txNonce, _zkLinkAddress, _subAccountId, _amount));
        // transfer no fee to Linea
        messageService.sendMessage{value: _amount}(remoteGateway, 0, callData);

        emit Deposit(_txNonce, ETH_ADDRESS, _amount, _zkLinkAddress, _subAccountId, false);
        txNonce = _txNonce + 1;
    }

    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override nonReentrant whenNotPaused {
        // ensure amount bridged is not zero
        require(_amount > 0, "Invalid token amount");
        require(msg.value == fee, "Invalid msg value");

        // transfer token from sender to LineaL1Gateway
        uint256 balanceBefore = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        // only support pure erc20 token
        uint256 balanceAfter = IERC20(_token).balanceOf(address(this));
        require(balanceAfter - balanceBefore == _amount, "Only support pure erc20 token");

        // bridge token to remoteGateway(the first message send to Linea)
        // no need to pay fee to message service
        (bool isUSDC, address nativeToken) = bridgeERC20ToRemoteGateway(_token, _amount, 0);

        // send depositERC20 command to LineaL2Gateway(the second message send to Linea)
        uint32 _txNonce = txNonce;
        bytes memory executeData = abi.encodeCall(ILineaL2Gateway.claimERC20Callback, (_txNonce, isUSDC, nativeToken, _amount, _zkLinkAddress, _subAccountId, _mapping));
        messageService.sendMessage(remoteGateway, 0, executeData);

        emit Deposit(_txNonce, _token, _amount, _zkLinkAddress, _subAccountId, _mapping);
        txNonce = _txNonce + 1;
    }

    function claimETHCallback(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyMessageService onlyRemoteGateway {
        require(msg.value == _amount, "Claim eth value not match");

        // send eth to receiver
        address receiver = updateAcceptReceiver(_owner, ETH_ADDRESS, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{value: _amount}("");
        require(success, "Claim eth failed");
        emit ClaimedWithdrawETH(receiver, _amount);
    }

    function claimERC20Callback(bool _isUSDC, address _nativeToken, address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external override onlyMessageService onlyRemoteGateway {
        // find target token on L1
        address targetToken = getTargetToken(_isUSDC, _nativeToken);

        // send token to receiver
        address receiver = updateAcceptReceiver(_owner, targetToken, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        IERC20(targetToken).safeTransfer(receiver, _amount);
        emit ClaimedWithdrawERC20(receiver, targetToken, _amount);
    }

    function claimSlaverSyncHash(bytes32 _syncHash) external override onlyMessageService onlyRemoteGateway {
        arbitrator.receiveSlaverSyncHash(_syncHash);
    }

    function claimMasterSyncHash(uint32 _blockNumber, bytes32 _syncHash) external override onlyMessageService onlyRemoteGateway {
        arbitrator.receiveMasterSyncHash(_blockNumber, _syncHash);
    }

    function estimateConfirmBlockFee(uint32 /**blockNumber**/) public view returns (uint nativeFee) {
        nativeFee = messageService.minimumFeeInWei();
    }

    function confirmBlock(uint32 blockNumber) external payable override onlyArbitrator {
        uint256 coinbaseFee = estimateConfirmBlockFee(blockNumber);
        require(msg.value == coinbaseFee, "Invalid fee");

        bytes memory callData = abi.encodeCall(IL2Gateway.claimBlockConfirmation, (blockNumber));
        messageService.sendMessage{value: msg.value}(address(remoteGateway), coinbaseFee, callData);
    }

    /// @notice Set deposit fee
    function setFee(uint64 _fee) external onlyOwner {
        fee = _fee;
        emit SetFee(_fee);
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
