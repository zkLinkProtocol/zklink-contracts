// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../stake/StakePool.sol";

contract StakePoolTest is StakePool {

    uint256 public currentBlock;

    constructor(address _nft, address _zkl, address _zkLink, address _masterAddress) StakePool(_nft, _zkl, _zkLink, _masterAddress) {

    }

    function setBlockNumber(uint256 n) external {
        currentBlock = n;
    }

    function setPoolLastRewardBlock(uint16 zklTokenId, uint256 n) external {
        poolInfo[zklTokenId].lastRewardBlock = n;
    }

    function setPoolPower(uint16 zklTokenId, uint128 p) external {
        poolInfo[zklTokenId].power = p;
    }

    function setPoolAccPerShare(uint16 zklTokenId, address t, uint256 s) external {
        poolInfo[zklTokenId].accPerShare[t] = s;
    }

    function setPoolDiscard(uint16 zklTokenId, uint256 ds, uint256 de, address t, uint256 s) external {
        poolInfo[zklTokenId].discardRewardStartBlock = ds;
        poolInfo[zklTokenId].discardRewardEndBlock = de;
        poolInfo[zklTokenId].discardRewardPerBlock[t] = s;
    }

    function setUserPower(uint16 zklTokenId, address u, uint128 p) external {
        userInfo[zklTokenId][u].power = p;
    }

    function setUserRewardDebt(uint16 zklTokenId, address u, address t, uint256 d) external {
        userInfo[zklTokenId][u].rewardDebt[t] = d;
    }

    function setUserPendingRewardDebt(uint16 zklTokenId, address u, uint32 nft, address t, uint256 d) external {
        userInfo[zklTokenId][u].pendingRewardDebt[nft][t] = d;
    }

    function _blockNumber() override internal view returns (uint256) {
        return currentBlock;
    }
}
