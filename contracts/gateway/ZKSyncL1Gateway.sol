// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IZkSync} from "@matterlabs/zksync-contracts/l1/contracts/zksync/interfaces/IZkSync.sol";
import {IL1Bridge as IZKSyncL1Bridge} from "@matterlabs/zksync-contracts/l1/contracts/bridge/interfaces/IL1Bridge.sol";

import {IZKSyncL1Gateway} from "contracts/interfaces/IZKSyncL1Gateway.sol";
import {IZKSyncL2Gateway} from "../interfaces/IZKSyncL2Gateway.sol";

contract ZKSyncL1Gateway is Ownable, IZKSyncL1Gateway {
    /// @notice zksync l2TxGasPerPubdataByte
    uint256 public constant REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

    bool public feeOn;

    /// @notice amount of L2 claim message fees users should pay for
    uint64 public fee;

    uint184 public txNonce;

    /// @dev Remote Gateway address
    address public remoteGateway;

    /// @notice zksync L1 message service
    IZkSync public zksync;

    /// @notice zksync refund recipient on L2
    address payable public refundRecipient;

    /// @notice zksync l1 bridge address
    address public zksyncL1Bridge;

    modifier zeroAddressCheck(address addressToSet) {
        if (addressToSet == address(0)) {
            revert InvalidParmas();
        }
        _;
    }

    constructor(IZkSync _zksync) {
        zksync = _zksync;
    }

    ///
    /// @param _token L1 ERC20 token address
    /// @param _amount amount to bridge
    /// @param _zkLinkAddress zklink address
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    /// @param _extendParams abi.encode(uint256 defaultBridgeGasLimit, uint256 defaultBridgeCost,uint256 l2GasLimit,uint256 gatewayCost)
    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping, bytes calldata _extendParams) external payable override {
        (uint256 _defaultBridgeGasLimit, uint256 _defaultBridgeCost, uint256 _l2GasLimit, uint256 _gatewayCost) = abi.decode(_extendParams, (uint256, uint256, uint256, uint256));

        if (feeOn) {
            require(msg.value == _defaultBridgeCost + _gatewayCost + fee, "fee");
        }

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20(_token).approve(zksyncL1Bridge, _amount);

        // bridge erc20 to remote gateway
        bytes32 txhash = IZKSyncL1Bridge(zksyncL1Bridge).deposit{value: _defaultBridgeCost}(
            remoteGateway,
            _token,
            _amount,
            _defaultBridgeGasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            refundRecipient
        );

        bytes memory _calldata = abi.encodeCall(
            IZKSyncL2Gateway.depositERC20,
            (IZKSyncL1Bridge(zksyncL1Bridge).l2TokenAddress(_token), _amount, _zkLinkAddress, _subAccountId, _mapping)
        );

        zksync.requestL2Transaction{value: _gatewayCost}(remoteGateway, 0, _calldata, _l2GasLimit, REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT, new bytes[](0), refundRecipient);

        txNonce++;
        emit DepositERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, txhash, txNonce);
    }

    /// deposit ETH to zklink by zksync bridge
    /// @param zklinkAddress zklink address
    /// @param subAccountId sub account id
    /// @param amount amount eth to bridge
    /// @param l2GasLimit L2 depositETH function call gas limit
    function depositETH(bytes32 zklinkAddress, uint8 subAccountId, uint256 amount, uint256 l2GasLimit, uint256 baseCost) external payable override {
        if (feeOn) {
            require(msg.value == amount + fee + baseCost, "fee");
        }

        bytes memory _calldata = abi.encodeCall(IZKSyncL2Gateway.depositETH, (zklinkAddress, subAccountId));
        bytes32 txhash = zksync.requestL2Transaction{value: baseCost + amount}(
            remoteGateway,
            amount,
            _calldata,
            l2GasLimit,
            REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT,
            new bytes[](0),
            refundRecipient
        );

        txNonce++;
        emit DepositETH(zklinkAddress, subAccountId, amount, txhash, txNonce);
    }

    function setFeeOnAndFee(bool _feeOn, uint64 _fee) external onlyOwner {
        feeOn = _feeOn;
        fee = _fee;
        emit SetFeeOn(_feeOn, _fee);
    }

    /// set refund recipient address of zksync
    /// @param _refundRecipient refund recipient address, suggest EOA address
    function setRefundRecipient(address _refundRecipient) external zeroAddressCheck(_refundRecipient) onlyOwner {
        refundRecipient = payable(_refundRecipient);
    }

    /// set zksync l1 bridge
    /// @param _zksyncL1Bridge zksync l1 bridge
    function setZKSyncL1Bridge(address _zksyncL1Bridge) external zeroAddressCheck(_zksyncL1Bridge) onlyOwner {
        zksyncL1Bridge = _zksyncL1Bridge;
    }

    /// withdraw fees
    /// @param receiver receiver address
    function withdrawFee(address payable receiver) external onlyOwner {
        receiver.transfer(address(this).balance);
    }
}
