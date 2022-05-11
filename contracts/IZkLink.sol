// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./Governance.sol";
import "./zksync/Operations.sol";

/// @title Interface of the ZKLink
/// @author zk.link
interface IZkLink {

    function exodusMode() external view returns (bool);

    function governance() external view returns (Governance);

    function firstPriorityRequestId() external view returns (uint64);

    function totalCommittedPriorityRequests() external view returns (uint64);

    function getPriorityRequest(uint64 idx) external view returns(Operations.PriorityOperation memory);

    function getAuthFact(address owner, uint32 nonce) external view returns (bytes32);

    function totalBlocksProven() external view returns (uint32);

    function totalBlocksExecuted() external view returns (uint32);

    function getCrossRootHash(uint32 blockHeight) external view returns (bytes32 blockHash, uint256 verifiedChains);

    function receiveCrossRootHash(uint16 srcChainId, uint64 nonce, bytes32 blockHash, uint256 verifiedChains) external;
}
