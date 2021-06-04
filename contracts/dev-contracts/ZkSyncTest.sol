// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../ZkSync.sol";
import "../SafeCast.sol";

contract ZkSyncTest is ZkSync {

    function setExodusMode(bool _exodusMode) external {
        exodusMode = _exodusMode;
    }

    function pairMint(address _pairToken, address _to, uint _amount) external {
        pairManager.mint(_pairToken, _to, SafeCast.toUint128(_amount));
    }

    function setBalancesToWithdraw(address _account, uint16 _tokenId, uint _balance) external {
        bytes22 packedBalanceKey = packAddressAndTokenId(_account, _tokenId);
        pendingBalances[packedBalanceKey].balanceToWithdraw = SafeCast.toUint128(_balance);
    }

    function setPriorityExpirationBlock(uint64 index, uint64 eb) external {
        priorityRequests[index].expirationBlock = eb;
    }

    function getPubdataHash(uint64 index) external view returns (bytes20) {
        return priorityRequests[index].hashedPubData;
    }

    function hashBytesToBytes20(bytes memory _bytes) external pure returns (bytes20) {
        return Utils.hashBytesToBytes20(_bytes);
    }
}
