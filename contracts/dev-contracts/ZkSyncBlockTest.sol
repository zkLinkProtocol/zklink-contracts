// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../SafeCast.sol";
import "../ZkSyncBlock.sol";

contract ZkSyncBlockTest is ZkSyncBlock {

    function testBlockCommitment(
        StoredBlockInfo memory _previousBlock,
        CommitBlockInfo memory _newBlockData,
        bytes memory _offsetCommitment
    ) external view returns (bytes32 commitment) {
        return createBlockCommitment(_previousBlock, _newBlockData, _offsetCommitment);
    }

    function testWithdrawOrStore(
        uint16 _tokenId,
        address _recipient,
        uint128 _amount) external {
        withdrawOrStore(_tokenId, _recipient, _amount);
    }

    function testWithdrawOrStoreWithLittleGas(
        uint16 _tokenId,
        address _recipient,
        uint128 _amount
    ) external {
        bytes22 packedBalanceKey = packAddressAndTokenId(_recipient, _tokenId);

        bool sent = false;
        // lp token will not transfer to vault and withdraw by mint new token to owner
        if (_tokenId >= PAIR_TOKEN_START_ID) {
            address _token = tokenAddresses[_tokenId];
            try pairManager.mint{gas: 1}(_token, _recipient, _amount) {
                sent = true;
            } catch {
                sent = false;
            }
        } else {
            // eth and non lp erc20 token is managed by vault and withdraw from vault
            // set lossBip to zero to avoid loss
            try vault.withdraw{gas: 1}(_tokenId, _recipient, _amount, _amount, 0) {
                sent = true;
            } catch {
                sent = false;
            }
        }
        if (sent) {
            emit Withdrawal(_tokenId, _amount);
        } else {
            increaseBalanceToWithdraw(packedBalanceKey, _amount);
        }
    }
}
