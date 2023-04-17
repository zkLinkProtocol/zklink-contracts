// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./interfaces/IVerifier.sol";

/// @title An empty verifier, used to deploy to zkevm chain that does not support ecpair temporarily
/// @author zk.link
contract EmptyVerifier is IVerifier {
    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {}

    /// @notice Verifier contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    // solhint-disable-next-line no-empty-blocks
    function upgrade(bytes calldata upgradeParameters) external {}

    function verifyAggregatedBlockProof(uint256[] memory, uint256[] memory, uint8[] memory, uint256[] memory, uint256[16] memory) external override pure returns (bool) {
        return false;
    }

    function verifyExitProof(bytes32, uint8, uint32, uint8, address, uint16, uint16, uint128, uint256[] calldata) external override pure returns (bool) {
        return false;
    }
}
