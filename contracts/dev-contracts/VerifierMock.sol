// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../zksync/Verifier.sol";

pragma experimental ABIEncoderV2;

contract VerifierMock is Verifier{

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
    ) external view override returns (bool) {
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
    ) external view override returns (bool) {
        return verifyResult;
    }
}
