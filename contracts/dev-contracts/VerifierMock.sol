// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

contract VerifierMock {

    function initialize(bytes calldata) external {}

    function upgrade(bytes calldata upgradeParameters) external {}

    bool public verifyResult;

    function setVerifyResult(bool r) external {
        verifyResult = r;
    }

    function verifyAggregatedBlockProof(
        uint256[] memory,
        uint256[] memory,
        uint8[] memory,
        uint256[] memory,
        uint256[16] memory
    ) external view returns (bool) {
        return verifyResult;
    }

    function verifyExitProof(
        bytes32,
        uint8,
        uint32,
        uint8,
        address,
        uint16,
        uint128,
        uint256[] calldata
    ) external view returns (bool) {
        return verifyResult;
    }
}
