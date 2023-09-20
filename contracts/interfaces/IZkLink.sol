// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZkLink interface contract
/// @author zk.link
interface IZkLink {
    // stored block info of ZkLink
    struct StoredBlockInfo {
        uint32 blockNumber;
        uint64 priorityOperations;
        bytes32 pendingOnchainOperationsHash;
        uint256 timestamp;
        bytes32 stateHash;
        bytes32 commitment;
        bytes32 syncHash;
    }

    /// @notice Return the network governor
    function networkGovernor() external view returns (address);

    /// @notice Get synchronized progress of zkLink contract known on deployed chain
    function getSynchronizedProgress(
        StoredBlockInfo memory block
    ) external view returns (uint256 progress);

    /// @notice Combine the `progress` of the other chains of a `syncHash` with self
    function receiveSynchronizationProgress(
        bytes32 syncHash,
        uint256 progress
    ) external;

    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    ) external;

    function depositETH(
        bytes32 _zkLinkAddress,
        uint8 _subAccountId
    ) external payable;
}
