// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;
pragma abicoder v2;

/// @notice interface come from https://bscscan.com/bytecode-decompiler?a=0x52d22f040dee3027422e837312320b42e1fd737f
/// HECO contract address: 0x22F560e032b256e8C7Cb50253591B0850162cb74
/// BSC contract address: 0x52d22f040dee3027422e837312320b42e1fd737f
/// Amount deposited to coinwind will not increase or decrease and farm reward token is COW and MDX
interface ICoinwind {

    struct PoolCowInfo {
        uint256 accCowPerShare;
        uint256 accCowShare;
        uint256 blockCowReward;
        uint256 blockMdxReward;
    }

    /// @notice return pool length
    function poolLength() external view returns (uint256);

    /// @notice return pool info
    function poolInfo(uint256 pid) external view returns (
        address token,
        uint256 lastRewardBlock,
        uint256 accMdxPerShare,
        uint256 govAccMdxPerShare,
        uint256 accMdxShare,
        uint256 totalAmount,
        uint256 totalAmountLimit,
        uint256 profit,
        uint256 earnLowerlimit,
        uint256 min,
        uint256 lastRewardBlockProfit,
        PoolCowInfo memory cowInfo);

    /// @notice deposit amount of token to coinwind
    function deposit(address token, uint256 amount) external;

    /// @notice deposit all amount of token to coinwind
    function depositAll(address token) external;

    /// @notice return the token amount user deposited
    function getDepositAsset(address token, address userAddress) external view returns (uint256);

    /// @notice withdraw amount token from coinwind and harvest all pending reward
    function withdraw(address token, uint256 amount) external;

    /// @notice withdraw all token from coinwind and harvest all pending reward
    function withdrawAll(address token) external;

    /// @notice withdraw all token from coinwind without harvest
    function emergencyWithdraw(uint256 pid) external;
}
