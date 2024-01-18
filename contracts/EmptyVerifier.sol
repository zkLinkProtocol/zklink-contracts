// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./interfaces/IVerifier.sol";

/// @title An empty verifier, used to deploy to zkevm chain that does not support ecpair temporarily
/// @author zk.link
contract EmptyVerifier is IVerifier {
    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {
        // no initialize need to do when delegatecall by Proxy
    }

    function verifyAggregatedBlockProof(uint256, uint256[] memory, uint256[] memory, uint256[] memory, uint256[16] memory, bytes32) external override pure returns (bool) {
        return false;
    }

    function verifyExitProof(bytes32, uint8, uint32, uint8, bytes32, uint16, uint16, uint128, uint256[] calldata) external override pure returns (bool) {
        return false;
    }
}
