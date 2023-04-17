// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../interfaces/IVerifier.sol";

contract VerifierMock is IVerifier {

    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {}

    /// @notice Verifier contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    // solhint-disable-next-line no-empty-blocks
    function upgrade(bytes calldata upgradeParameters) external {}

    bool public verifyResult = true;

    function setVerifyResult(bool r) external {
        verifyResult = r;
    }

    function verifyAggregatedBlockProof(
        uint256[] memory,
        uint256[] memory,
        uint8[] memory,
        uint256[] memory,
        uint256[16] memory
    ) external override view returns (bool) {
        return verifyResult;
    }

    function verifyExitProof(
        bytes32,
        uint8,
        uint32,
        uint8,
        address,
        uint16,
        uint16,
        uint128,
        uint256[] calldata
    ) external override view returns (bool) {
        return verifyResult;
    }
}
