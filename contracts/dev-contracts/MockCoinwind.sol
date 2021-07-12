// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;
pragma abicoder v2;

import "../strategy/ICoinwind.sol";
import "./ERC20.sol";

/// @notice a dummy version of coinwind because coinwind is not open source yet
contract MockCoinwind is ICoinwind {

    address public cow;
    address public mdx;
    address[] public pools;
    mapping(address => mapping(address => uint256)) userDeposited;
    mapping(address => mapping(address => uint256)) userPendingReward;

    constructor(address _cow, address _mdx) {
        cow = _cow;
        mdx = _mdx;
    }

    function addPool(address token) external {
        pools.push(token);
    }

    function poolLength() override external view returns (uint256) {
        return pools.length;
    }

    function poolInfo(uint256 pid) override external view returns (
        address token,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        PoolCowInfo memory) {
        PoolCowInfo memory pci;
        return (pools[pid],0,0,0,0,0,0,0,0,0,0,pci);
    }

    function deposit(address token, uint256 amount) override public {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        userDeposited[token][msg.sender] += amount;
    }

    function depositAll(address token) override external {
        uint256 balance = IERC20(token).balanceOf(msg.sender);
        if (balance > 0) {
            deposit(token, balance);
        }
    }

    function getDepositAsset(address token, address userAddress) override public view returns (uint256) {
        return userDeposited[token][userAddress];
    }

    function withdraw(address token, uint256 amount) override public {
        if (amount > 0) {
            IERC20(token).transfer(msg.sender, amount);
            userDeposited[token][msg.sender] -= amount;
        }
        harvest();
    }

    function withdrawAll(address token) override external {
        withdraw(token, getDepositAsset(token, msg.sender));
    }

    function emergencyWithdraw(uint256 pid) override external {
        address token = pools[pid];
        uint256 amount = getDepositAsset(token, msg.sender);
        if (amount > 0) {
            IERC20(token).transfer(msg.sender, amount);
            userDeposited[token][msg.sender] -= amount;
        }
    }

    function addPendingReward(address token, address account, uint256 amount) external {
        ERC20(token).mint(amount);
        userPendingReward[token][account] += amount;
    }

    function harvest() internal {
        harvestToken(cow);
        harvestToken(mdx);
    }

    function harvestToken(address token) internal {
        uint256 pendingAmount = userPendingReward[token][msg.sender];
        if (pendingAmount > 0) {
            IERC20(token).transfer(msg.sender, pendingAmount);
            userPendingReward[token][msg.sender] = 0;
        }
    }
}
