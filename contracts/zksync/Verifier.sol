// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./KeysWithPlonkVerifier.sol";
import "./Config.sol";
import "../interfaces/IVerifier.sol";

// Hardcoded constants to avoid accessing store
contract Verifier is IVerifier, KeysWithPlonkVerifier, KeysWithPlonkVerifierOld, Config {
    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {}

    /// @notice Verifier contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    // solhint-disable-next-line no-empty-blocks
    function upgrade(bytes calldata upgradeParameters) external {}

    function verifyAggregatedBlockProof(uint256[] memory _recursiveInput, uint256[] memory _proof, uint8[] memory _vkIndexes, uint256[] memory _individualVksInputs, uint256[16] memory _subProofsLimbs) external override virtual view returns (bool) {
        for (uint256 i = 0; i < _individualVksInputs.length; ++i) {
            _individualVksInputs[i] = _individualVksInputs[i] & INPUT_MASK;
        }
        VerificationKey memory vk = getVkAggregated(uint32(_vkIndexes.length));

        return
        verify_serialized_proof_with_recursion(
            _recursiveInput,
            _proof,
            VK_TREE_ROOT,
            VK_MAX_INDEX,
            _vkIndexes,
            _individualVksInputs,
            _subProofsLimbs,
            vk
        );
    }

    function verifyExitProof(bytes32 _rootHash, uint8 _chainId, uint32 _accountId, uint8 _subAccountId, address _owner, uint16 _tokenId, uint16 _srcTokenId, uint128 _amount, uint256[] calldata _proof) external override virtual view returns (bool) {
        bytes32 commitment = sha256(abi.encodePacked(_rootHash, _chainId, _accountId, _subAccountId, _owner, _tokenId, _srcTokenId, _amount));

        uint256[] memory inputs = new uint256[](1);
        inputs[0] = uint256(commitment) & INPUT_MASK;
        ProofOld memory proof = deserialize_proof_old(inputs, _proof);
        VerificationKeyOld memory vk = getVkExit();
        require(vk.num_inputs == inputs.length, "V0");
        return verify_old(proof, vk);
    }
}
