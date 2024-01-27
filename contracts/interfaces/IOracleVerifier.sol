// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Oracle verifier
/// @author zk.link
interface IOracleVerifier {

    /// @notice Estimate verify fee
    /// @param oracleContent the oracle content
    function estimateVerifyFee(bytes memory oracleContent) external view returns (uint256 nativeFee);

    /// @notice Verify oracle content and return the commitment used by zk verifier
    /// @param oracleContent the oracle content
    function verify(bytes memory oracleContent) external payable returns (bytes32 oracleCommitment);
}