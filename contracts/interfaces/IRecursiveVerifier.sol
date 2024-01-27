// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Recursive verifier interface contract
/// @author zk.link
interface IRecursiveVerifier {
    function vksCommitment() external view returns (bytes32);

    function verify(
        uint256[] calldata _publicInputs,
        uint256[] calldata _proof,
        uint256[] calldata _recursiveAggregationInput
    ) external view returns (bool);
}