// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./Governance.sol";
import "./zksync/Operations.sol";

/// @title Interface of the ZKLink
/// @author zk.link
interface IZkLink {

    function governance() external view returns (Governance);

    function firstPriorityRequestId() external view returns (uint64);

    function totalCommittedPriorityRequests() external view returns (uint64);

    function getPriorityRequest(uint64 idx) external view returns(Operations.PriorityOperation memory);

    function getAuthFact(address owner, uint32 nonce) external view returns (bytes32);
}
