//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IL2Gateway.sol";

contract L2GatewayMock is IL2Gateway {

    function withdrawETH(address /**_owner*/, uint128 /**_amount*/, uint32 /**_accountIdOfNonce*/, uint8 /**_subAccountIdOfNonce*/, uint32 /**_nonce*/, uint16 /**_fastWithdrawFeeRate*/) external payable {
        // do nothing
    }

    function withdrawERC20(address /**_owner*/, address _token, uint128 _amount, uint32 /**_accountIdOfNonce*/, uint8  /**_subAccountIdOfNonce*/, uint32 /**_nonce*/, uint16 /**_fastWithdrawFeeRate*/) external payable {
        // transfer token to self
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    }

    function estimateSendSlaverSyncHashFee(bytes32) external pure returns (uint nativeFee) {
        nativeFee = 0;
    }

    function sendSlaverSyncHash(bytes32) external payable {
        // do nothing
    }

    function estimateSendMasterSyncHashFee(uint32, bytes32) external pure returns (uint nativeFee) {
        nativeFee = 0;
    }

    function sendMasterSyncHash(uint32, bytes32) external payable {
        // do nothing
    }

    function claimBlockConfirmation(uint32 _blockNumber) external {
        // do nothing
    }
}