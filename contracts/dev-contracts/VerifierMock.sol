// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../interfaces/IVerifier.sol";

contract VerifierMock is IVerifier {

    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {}

    bool public verifyResult = true;

    function setVerifyResult(bool r) external {
        verifyResult = r;
    }

    function verifyAggregatedBlockProof(uint256, uint256[] memory, uint256[] memory, uint256[] memory, uint256[16] memory, bytes32) external override view returns (bool) {
        return verifyResult;
    }

    function verifyExitProof(
        bytes32,
        uint8,
        uint32,
        uint8,
        bytes32,
        uint16,
        uint16,
        uint128,
        uint256[] calldata
    ) external override view returns (bool) {
        return verifyResult;
    }
}
