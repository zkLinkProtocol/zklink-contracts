// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IZkLink} from "../../interfaces/IZkLink.sol";
import {IL2Bridge} from "../../interfaces/zksync/IL2Bridge.sol";
import {IL2Messenger} from "../../interfaces/zksync/IL2Messenger.sol";
import {IL2ETHToken} from "../../interfaces/zksync/IL2ETHToken.sol";
import {IZkSyncL2Gateway} from "../../interfaces/zksync/IZkSyncL2Gateway.sol";
import {IZkSyncL1Gateway} from "../../interfaces/zksync/IZkSyncL1Gateway.sol";
import {BaseGateway} from "../BaseGateway.sol";
import {L2BaseGateway} from "../L2BaseGateway.sol";
import {AddressAliasHelper} from "../AddressAliasHelper.sol";
import {ZkSyncMessageConfig} from "./ZkSyncMessageConfig.sol";

contract ZkSyncL2Gateway is ZkSyncMessageConfig, L2BaseGateway, BaseGateway, IZkSyncL2Gateway {
    using SafeERC20 for IERC20;

    uint160 internal constant SYSTEM_CONTRACTS_OFFSET = 0x8000; // 2^15

    /// @notice ZkSync system message service on local chain
    IL2Messenger public constant L2_MESSENGER = IL2Messenger(address(SYSTEM_CONTRACTS_OFFSET + 0x08));

    /// @notice ZkSync eth bridge service on local chain
    IL2ETHToken public constant L2_ETH_ADDRESS = IL2ETHToken(address(SYSTEM_CONTRACTS_OFFSET + 0x0a));

    /// @notice ZkSync token bridge service on local chain
    IL2Bridge public tokenBridge;

    event ClaimedDeposit(uint32 indexed _txNonce);

    /// @dev Modifier to make sure the original sender is gateway on remote chain.
    modifier onlyRemoteGateway() {
        require(AddressAliasHelper.undoL1ToL2Alias(msg.sender) == remoteGateway, "Not remote gateway");
        _;
    }

    function initialize(IZkLink _zkLink, IL2Bridge _tokenBridge) external initializer {
        __L2BaseGateway_init(_zkLink);
        __BaseGateway_init();

        tokenBridge = _tokenBridge;
    }

    function claimETH(uint32 _txNonce, bytes32 _zkLinkAddress, uint8 _subAccountId, uint256 _amount) external payable override onlyRemoteGateway {
        require(msg.value == _amount, "Claim eth value not match");

        zkLink.depositETH{value: _amount}(_zkLinkAddress, _subAccountId);
        emit ClaimedDeposit(_txNonce);
    }

    function claimERC20(uint32 _txNonce, address _l1Token, uint256 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external override onlyRemoteGateway {
        // find target token on zkSync
        address targetToken = tokenBridge.l2TokenAddress(_l1Token);
        // approve token to zkLink
        IERC20(targetToken).safeApprove(address(zkLink), _amount);
        // deposit erc20 to zkLink
        uint104 amount = uint104(_amount);
        zkLink.depositERC20(IERC20(targetToken), amount, _zkLinkAddress, _subAccountId, _mapping);
        emit ClaimedDeposit(_txNonce);
    }

    function claimBlockConfirmation(uint32 _blockNumber) external override onlyRemoteGateway{
        zkLink.receiveBlockConfirmation(_blockNumber);
    }

    function estimateWithdrawETHFee(address /**_owner**/, uint128 /**_amount**/, uint32 /**_accountIdOfNonce**/, uint8 /**_subAccountIdOfNonce**/, uint32 /**_nonce**/, uint16 /**_fastWithdrawFeeRate**/) external pure returns (uint256 nativeFee) {
        nativeFee = 0;
    }

    function withdrawETH(address _owner, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink whenNotPaused {
        require(msg.value == _amount, "Invalid value");

        // send eth to ZkSyncL1Gateway(the first message send to L1)
        L2_ETH_ADDRESS.withdraw{value: _amount}(remoteGateway);

        // send withdraw eth command to ZkSyncL1Gateway(the second message send to L1)
        bytes memory callData = abi.encodePacked(IZkSyncL1Gateway.finalizeMessage.selector, MESSAGE_WITHDRAW_ETH, _owner, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        L2_MESSENGER.sendToL1(callData);
    }

    function estimateWithdrawERC20Fee(address /**_owner**/, address /**_token**/, uint128 /**_amount**/, uint32 /**_accountIdOfNonce**/, uint8 /**_subAccountIdOfNonce**/, uint32 /**_nonce**/, uint16 /**_fastWithdrawFeeRate**/) external pure returns (uint256 nativeFee) {
        nativeFee = 0;
    }

    function withdrawERC20(address _owner, address _token, uint128 _amount, uint32 _accountIdOfNonce, uint8 _subAccountIdOfNonce, uint32 _nonce, uint16 _fastWithdrawFeeRate) external payable override onlyZkLink whenNotPaused {
        // transfer token from sender to ZkSyncL2Gateway
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // bridge token to remoteGateway(the first message send to L1)
        tokenBridge.withdraw(remoteGateway, _token, _amount);

        // send withdrawERC20 command to ZkSyncL1Gateway(the second message send to L1)
        address l1Token = tokenBridge.l1TokenAddress(_token);
        bytes memory callData = abi.encodePacked(IZkSyncL1Gateway.finalizeMessage.selector, MESSAGE_WITHDRAW_ERC20, _owner, l1Token, _amount, _accountIdOfNonce, _subAccountIdOfNonce, _nonce, _fastWithdrawFeeRate);
        L2_MESSENGER.sendToL1(callData);
    }

    function estimateSendSlaverSyncHashFee(bytes32 /**syncHash**/) external pure returns (uint nativeFee) {
        nativeFee = 0;
    }

    function sendSlaverSyncHash(bytes32 syncHash) external payable override onlyZkLink whenNotPaused {
        bytes memory callData = abi.encodePacked(IZkSyncL1Gateway.finalizeMessage.selector, MESSAGE_SEND_SLAVER_SYNC_HASH, syncHash);
        L2_MESSENGER.sendToL1(callData);
    }

    function estimateSendMasterSyncHashFee(uint32 /**blockNumber**/, bytes32 /**syncHash**/) external pure returns (uint nativeFee) {
        nativeFee = 0;
    }

    function sendMasterSyncHash(uint32 blockNumber, bytes32 syncHash) external payable override onlyZkLink whenNotPaused {
        bytes memory callData = abi.encodePacked(IZkSyncL1Gateway.finalizeMessage.selector, MESSAGE_SEND_MASTER_SYNC_HASH, blockNumber, syncHash);
        L2_MESSENGER.sendToL1(callData);
    }
}
