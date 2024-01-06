// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IL2Gateway} from "../../interfaces/IL2Gateway.sol";
import {IZkSyncL2Gateway} from "../../interfaces/zksync/IZkSyncL2Gateway.sol";
import {IZkSyncL1Gateway} from "../../interfaces/zksync/IZkSyncL1Gateway.sol";
import {IZkSync} from "../../interfaces/zksync/IZkSync.sol";
import {IL1Bridge} from "../../interfaces/zksync/IL1Bridge.sol";
import {L1BaseGateway} from "../L1BaseGateway.sol";
import {BaseGateway} from "../BaseGateway.sol";
import {ZkSyncMessageConfig} from "./ZkSyncMessageConfig.sol";
import {Bytes} from "../../zksync/Bytes.sol";

contract ZkSyncL1Gateway is ZkSyncMessageConfig, L1BaseGateway, BaseGateway, IZkSyncL1Gateway {
    using SafeERC20 for IERC20;

    /// @dev The L2 gasPricePerPubdata required to be used in bridges.
    uint256 public constant REQUIRED_L2_GAS_PRICE_PER_PUBDATA = 800;

    /// @dev The gas limit of finalizeDeposit on L2ERC20Bridge
    uint256 public finalizeDepositL2GasLimit;

    /// @dev The gas limit of claimETH on ZkSyncL2Gateway
    uint256 public claimETHL2GasLimit;

    /// @dev The gas limit of claimERC20 on ZkSyncL2Gateway
    uint256 public claimERC20L2GasLimit;

    /// @dev The gas limit of claimBlockConfirmation on ZkSyncL2Gateway
    uint256 public claimBlockConfirmationL2GasLimit;

    /// @notice ZkSync message service on local chain
    IZkSync public messageService;

    /// @notice ZkSync token bridge on local chain
    IL1Bridge public tokenBridge;

    /// @notice Used to prevent off-chain monitoring events from being lost
    uint32 public txNonce;

    /// @dev A mapping L2 batch number => message number => flag
    /// @dev Used to indicate that zkSync L2 -> L1 message was already processed
    mapping(uint256 => mapping(uint256 => bool)) public isMessageFinalized;

    event Deposit(uint32 indexed txNonce, address token, uint256 amount, bytes32 zklinkAddress, uint8 subAccountId, bool _mapping);
    event ClaimedWithdrawETH(address _receiver, uint256 _amount);
    event ClaimedWithdrawERC20(address _receiver, address _token, uint256 _amount);

    function initialize(IZkSync _messageService, IL1Bridge _tokenBridge) external initializer {
        __BaseGateway_init();

        finalizeDepositL2GasLimit = 1000000;
        claimETHL2GasLimit = 2000000;
        claimERC20L2GasLimit = 2000000;
        claimBlockConfirmationL2GasLimit = 500000;

        messageService = _messageService;
        tokenBridge = _tokenBridge;
    }

    function setFinalizeDepositL2GasLimit(uint256 _finalizeDepositL2GasLimit) external onlyOwner {
        finalizeDepositL2GasLimit = _finalizeDepositL2GasLimit;
    }

    function setClaimETHL2GasLimit(uint256 _claimETHL2GasLimit) external onlyOwner {
        claimETHL2GasLimit = _claimETHL2GasLimit;
    }

    function setClaimERC20L2GasLimit(uint256 _claimERC20L2GasLimit) external onlyOwner {
        claimERC20L2GasLimit = _claimERC20L2GasLimit;
    }

    function setClaimBlockConfirmationL2GasLimit(uint256 _claimBlockConfirmationL2GasLimit) external onlyOwner {
        claimBlockConfirmationL2GasLimit = _claimBlockConfirmationL2GasLimit;
    }

    function depositETH(uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override nonReentrant whenNotPaused {
        // ensure amount bridged is not zero
        require(_amount > 0, "Invalid eth amount");

        uint256 claimDepositFee = messageService.l2TransactionBaseCost(tx.gasprice, claimETHL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA);
        uint256 requiredValue = claimDepositFee + _amount;
        require(msg.value >= requiredValue, "Value too low");
        uint256 leftMsgValue = msg.value - requiredValue;

        uint32 _txNonce = txNonce;
        bytes memory executeData = abi.encodeCall(IZkSyncL2Gateway.claimETH, (_txNonce, _zkLinkAddress, _subAccountId, _amount));
        messageService.requestL2Transaction{value: requiredValue}(remoteGateway, _amount, executeData, claimETHL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, new bytes[](0), tx.origin);

        if (leftMsgValue > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = msg.sender.call{value: leftMsgValue}("");
            require(success, "Refund failed");
        }

        emit Deposit(_txNonce, ETH_ADDRESS, _amount, _zkLinkAddress, _subAccountId, false);
        txNonce = _txNonce + 1;
    }

    function depositERC20(address _token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override nonReentrant whenNotPaused {
        // ensure amount bridged is not zero
        require(_amount > 0, "Invalid token amount");

        // transfer token from sender to ZkSyncL1Gateway
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // approve bridge
        IERC20(_token).safeApprove(address(tokenBridge), _amount);
        // bridge token to remoteGateway
        uint256 leftMsgValue = msg.value;
        uint256 bridgeTokenFee = messageService.l2TransactionBaseCost(tx.gasprice, finalizeDepositL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA);
        require(leftMsgValue >= bridgeTokenFee, "Insufficient fee for bridge token");
        tokenBridge.deposit{value: bridgeTokenFee}(remoteGateway, _token, _amount, finalizeDepositL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, tx.origin);
        leftMsgValue -= bridgeTokenFee;

        // send depositERC20 command to ZkSyncL2Gateway(the second message send to ZkSync)
        uint256 claimDepositFee = messageService.l2TransactionBaseCost(tx.gasprice, claimERC20L2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA);
        require(leftMsgValue >= claimDepositFee, "Insufficient fee for claim token");
        uint32 _txNonce = txNonce;
        bytes memory executeData = abi.encodeCall(IZkSyncL2Gateway.claimERC20, (_txNonce, _token, _amount, _zkLinkAddress, _subAccountId, _mapping));
        messageService.requestL2Transaction{value: claimDepositFee}(remoteGateway, 0, executeData, claimERC20L2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, new bytes[](0), tx.origin);
        leftMsgValue -= claimDepositFee;

        if (leftMsgValue > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = msg.sender.call{value: leftMsgValue}("");
            require(success, "Refund failed");
        }

        emit Deposit(_txNonce, _token, _amount, _zkLinkAddress, _subAccountId, _mapping);
        txNonce = _txNonce + 1;
    }

    function estimateConfirmBlockFee(uint32 /**blockNumber**/) public view returns (uint nativeFee) {
        nativeFee = messageService.l2TransactionBaseCost(tx.gasprice, claimBlockConfirmationL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA);
    }

    function confirmBlock(uint32 blockNumber) external payable override onlyArbitrator {
        require(msg.value == estimateConfirmBlockFee(blockNumber), "Invalid fee");

        bytes memory executeData = abi.encodeCall(IL2Gateway.claimBlockConfirmation, (blockNumber));
        messageService.requestL2Transaction{value: msg.value}(remoteGateway, 0, executeData, claimBlockConfirmationL2GasLimit, REQUIRED_L2_GAS_PRICE_PER_PUBDATA, new bytes[](0), tx.origin);
    }

    function finalizeMessage(uint256 _l2BatchNumber, uint256 _l2MessageIndex, uint16 _l2TxNumberInBatch, bytes memory _message, bytes32[] calldata _merkleProof) external override {
        require(!isMessageFinalized[_l2BatchNumber][_l2MessageIndex], "Message was finalized");

        IZkSync.L2Message memory l2ToL1Message = IZkSync.L2Message({
            txNumberInBatch: _l2TxNumberInBatch,
            sender: remoteGateway,
            data: _message
        });

        bool success = messageService.proveL2MessageInclusion(_l2BatchNumber, _l2MessageIndex, l2ToL1Message, _merkleProof);
        require(success, "Invalid message");

        (uint256 offset, uint32 functionSignature) = Bytes.readUInt32(_message, 0);
        require(bytes4(functionSignature) == this.finalizeMessage.selector, "Invalid function selector");

        uint8 messageType;
        (offset, messageType) = Bytes.readUint8(_message, offset);
        if (messageType == MESSAGE_WITHDRAW_ETH) {
            claimETH(_message, offset);
        } else if (messageType == MESSAGE_WITHDRAW_ERC20) {
            claimERC20(_message, offset);
        } else if (messageType == MESSAGE_SEND_SLAVER_SYNC_HASH) {
            claimSlaverSyncHash(_message, offset);
        } else if (messageType == MESSAGE_SEND_MASTER_SYNC_HASH) {
            claimMasterSyncHash(_message, offset);
        } else {
            revert("Invalid message type");
        }

        isMessageFinalized[_l2BatchNumber][_l2MessageIndex] = true;
    }

    function claimETH(bytes memory _message, uint256 offset) internal {
        address _owner;
        uint128 _amount;
        uint32 _accountIdOfNonce;
        uint8 _subAccountIdOfNonce;
        uint32 _nonce;
        uint16 _fastWithdrawFeeRate;
        (offset, _owner) = Bytes.readAddress(_message, offset);
        (offset, _amount) = Bytes.readUInt128(_message, offset);
        (offset, _accountIdOfNonce) = Bytes.readUInt32(_message, offset);
        (offset, _subAccountIdOfNonce) = Bytes.readUint8(_message, offset);
        (offset, _nonce) = Bytes.readUInt32(_message, offset);
        (offset, _fastWithdrawFeeRate) = Bytes.readUInt16(_message, offset);

        // send eth to receiver
        address receiver = updateAcceptReceiver(_owner, ETH_ADDRESS, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{value: _amount}("");
        require(success, "Claim eth failed");
        emit ClaimedWithdrawETH(receiver, _amount);
    }

    function claimERC20(bytes memory _message, uint256 offset) internal {
        address _owner;
        address _l1Token;
        uint128 _amount;
        uint32 _accountIdOfNonce;
        uint8 _subAccountIdOfNonce;
        uint32 _nonce;
        uint16 _fastWithdrawFeeRate;
        (offset, _owner) = Bytes.readAddress(_message, offset);
        (offset, _l1Token) = Bytes.readAddress(_message, offset);
        (offset, _amount) = Bytes.readUInt128(_message, offset);
        (offset, _accountIdOfNonce) = Bytes.readUInt32(_message, offset);
        (offset, _subAccountIdOfNonce) = Bytes.readUint8(_message, offset);
        (offset, _nonce) = Bytes.readUInt32(_message, offset);
        (offset, _fastWithdrawFeeRate) = Bytes.readUInt16(_message, offset);

        // send token to receiver
        address receiver = updateAcceptReceiver(_owner, _l1Token, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        IERC20(_l1Token).safeTransfer(receiver, _amount);
        emit ClaimedWithdrawERC20(receiver, _l1Token, _amount);
    }

    function claimSlaverSyncHash(bytes memory _message, uint256 offset) internal {
        bytes32 _syncHash;
        (offset, _syncHash) = Bytes.readBytes32(_message, offset);

        arbitrator.receiveSlaverSyncHash(_syncHash);
    }

    function claimMasterSyncHash(bytes memory _message, uint256 offset) internal{
        uint32 _blockNumber;
        bytes32 _syncHash;
        (offset, _blockNumber) = Bytes.readUInt32(_message, offset);
        (offset, _syncHash) = Bytes.readBytes32(_message, offset);

        arbitrator.receiveMasterSyncHash(_blockNumber, _syncHash);
    }
}
