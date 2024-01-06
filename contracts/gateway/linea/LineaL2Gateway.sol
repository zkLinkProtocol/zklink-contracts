// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILineaL2Gateway} from "../../interfaces/linea/ILineaL2Gateway.sol";
import {ILineaL1Gateway} from "../../interfaces/linea/ILineaL1Gateway.sol";
import {IMessageService} from "../../interfaces/linea/IMessageService.sol";
import {IUSDCBridge} from "../../interfaces/linea/IUSDCBridge.sol";
import {ITokenBridge} from "../../interfaces/linea/ITokenBridge.sol";
import {IZkLink} from "../../interfaces/IZkLink.sol";
import {LineaGateway} from "./LineaGateway.sol";
import {L2BaseGateway} from "../L2BaseGateway.sol";

contract LineaL2Gateway is L2BaseGateway, LineaGateway, ILineaL2Gateway {
    using SafeERC20 for IERC20;

    event ClaimedDeposit(uint32 indexed _txNonce);

    function initialize(IZkLink _zkLink, IMessageService _messageService, ITokenBridge _tokenBridge, IUSDCBridge _usdcBridge) external initializer {
        __L2BaseGateway_init(_zkLink);
        __LineaGateway_init(_messageService, _tokenBridge, _usdcBridge);
    }

    function claimETHCallback(uint32 _txNonce, bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable onlyMessageService onlyRemoteGateway {
        require(msg.value == _amount, "Claim eth value not match");

        zkLink.depositETH{value: _amount}(_zkLinkAddress, _subAccountId);
        emit ClaimedDeposit(_txNonce);
    }

    function claimERC20Callback(uint32 _txNonce, bool _isUSDC, address _nativeToken, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external override onlyMessageService onlyRemoteGateway {
        // find target token on Linea
        address targetToken = getTargetToken(_isUSDC, _nativeToken);
        // approve token to zkLink
        IERC20(targetToken).safeApprove(address(zkLink), _amount);
        // deposit erc20 to zkLink
        uint104 amount = uint104(_amount);
        zkLink.depositERC20(IERC20(targetToken), amount, _zkLinkAddress, _subAccountId, _mapping);
        emit ClaimedDeposit(_txNonce);
    }

    function claimBlockConfirmation(uint32 _blockNumber) external override onlyMessageService onlyRemoteGateway{
        zkLink.receiveBlockConfirmation(_blockNumber);
    }

    function estimateWithdrawETHFee(address /**_owner**/, uint128 /**_amount**/, uint32 /**_accountIdOfNonce**/, uint8 /**_subAccountIdOfNonce**/, uint32 /**_nonce**/, uint16 /**_fastWithdrawFeeRate**/) external view returns (uint256 nativeFee) {
        nativeFee = messageService.minimumFeeInWei();
    }

    function withdrawETH(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink whenNotPaused {
        uint256 coinbaseFee = messageService.minimumFeeInWei();
        require(msg.value == _amount + coinbaseFee, "Invalid fee");

        bytes memory callData = abi.encodeCall(ILineaL1Gateway.claimETHCallback, (_owner, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate));
        messageService.sendMessage{value: msg.value}(address(remoteGateway), coinbaseFee, callData);
    }

    function estimateWithdrawERC20Fee(address /**_owner**/, address /**_token**/, uint128 /**_amount**/, uint32 /**_accountIdOfNonce**/, uint8 /**_subAccountIdOfNonce**/, uint32 /**_nonce**/, uint16 /**_fastWithdrawFeeRate**/) external view returns (uint256 nativeFee) {
        nativeFee = messageService.minimumFeeInWei() * 2;
    }

    function withdrawERC20(address _owner, address _token, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink whenNotPaused {
        // ensure msg value can satisfy the need to send two bridge messages
        uint256 coinbaseFee = messageService.minimumFeeInWei();
        require(msg.value == coinbaseFee * 2, "Invalid fee");

        // transfer token from sender to LineaL2Gateway
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // bridge token to remoteGateway(the first message send to L1)
        (bool isUSDC, address nativeToken) = bridgeERC20ToRemoteGateway(_token, _amount, coinbaseFee);

        // send withdrawERC20 command to LineaL1Gateway(the second message send to L1)
        bytes memory executeData = abi.encodeCall(ILineaL1Gateway.claimERC20Callback, (isUSDC, nativeToken, _owner, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate));
        messageService.sendMessage{value: coinbaseFee}(remoteGateway, coinbaseFee, executeData);
    }

    function estimateSendSlaverSyncHashFee(bytes32 /**syncHash**/) external view returns (uint nativeFee) {
        nativeFee = messageService.minimumFeeInWei();
    }

    function sendSlaverSyncHash(bytes32 syncHash) external payable override onlyZkLink whenNotPaused {
        uint256 coinbaseFee = messageService.minimumFeeInWei();
        require(msg.value == coinbaseFee, "Invalid fee");

        bytes memory callData = abi.encodeCall(ILineaL1Gateway.claimSlaverSyncHash, (syncHash));
        messageService.sendMessage{value: msg.value}(address(remoteGateway), coinbaseFee, callData);
    }

    function estimateSendMasterSyncHashFee(uint32 /**blockNumber**/, bytes32 /**syncHash**/) external view returns (uint nativeFee) {
        nativeFee = messageService.minimumFeeInWei();
    }

    function sendMasterSyncHash(uint32 blockNumber, bytes32 syncHash) external payable override onlyZkLink whenNotPaused {
        uint256 coinbaseFee = messageService.minimumFeeInWei();
        require(msg.value == coinbaseFee, "Invalid fee");

        bytes memory callData = abi.encodeCall(ILineaL1Gateway.claimMasterSyncHash, (blockNumber, syncHash));
        messageService.sendMessage{value: msg.value}(address(remoteGateway), coinbaseFee, callData);
    }
}
