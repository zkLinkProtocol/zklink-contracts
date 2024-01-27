// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import {IRecursiveVerifier} from "./interfaces/IRecursiveVerifier.sol";
import {IExitVerifier} from "./interfaces/IExitVerifier.sol";
import {IOracleVerifier} from "./interfaces/IOracleVerifier.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import "hardhat/console.sol";

/// @title ZkLink verifier contract
/// @author zk.link
contract ZkLinkVerifier is IVerifier {
    /// @dev Shift to apply to verify public input before verifying.
    uint256 internal constant INPUT_MASK = 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    IRecursiveVerifier public immutable recursiveVerifier;
    IExitVerifier public immutable exitVerifier;
    IOracleVerifier public immutable oracleVerifier;

    constructor(IRecursiveVerifier _recursiveVerifier, IExitVerifier _exitVerifier, IOracleVerifier _oracleVerifier) {
        recursiveVerifier = _recursiveVerifier;
        exitVerifier = _exitVerifier;
        oracleVerifier = _oracleVerifier;
    }

    // solhint-disable-next-line no-empty-blocks
    function initialize(bytes calldata) external {}

    function estimateVerifyFee(ProofInput memory _proof) external view returns (uint256 nativeFee) {
        nativeFee = oracleVerifier.estimateVerifyFee(_proof.oracleContent);
    }

    function verify(ProofInput memory _proof) external payable returns (bool) {
        // verify oracle content
        uint256 oracleVerifyFee = oracleVerifier.estimateVerifyFee(_proof.oracleContent);
        require(msg.value == oracleVerifyFee, "Invalid proof fee");
        bytes32 _oracleCommitment = oracleVerifier.verify{value: oracleVerifyFee}(_proof.oracleContent);

        // verify recursive proof
        uint256 _publicInput = _getBatchProofPublicInput(recursiveVerifier.vksCommitment(), _proof.blockInputs, _oracleCommitment, _proof.subProofsLimbs);
        uint256[] memory _publicInputs = new uint256[](1);
        _publicInputs[0] = _publicInput;
        return recursiveVerifier.verify(_publicInputs, _proof.proof, _proof.subProofsLimbs);
    }

    function verifyExitProof(bytes32 _rootHash, uint8 _chainId, uint32 _accountId, uint8 _subAccountId, bytes32 _owner, uint16 _tokenId, uint16 _srcTokenId, uint128 _amount, uint256[] calldata _proof) external view returns (bool) {
        return exitVerifier.verifyExitProof(_rootHash, _chainId, _accountId, _subAccountId, _owner, _tokenId, _srcTokenId, _amount, _proof);
    }

    function getBatchProofPublicInput(bytes32 _vksCommitment, uint256[] memory _blockInputs, bytes32 _oracleCommitment, uint256[] memory _subProofsLimbs) external pure returns (uint256) {
        return _getBatchProofPublicInput(_vksCommitment, _blockInputs, _oracleCommitment, _subProofsLimbs);
    }

    /// @dev Gets zk proof public input
    function _getBatchProofPublicInput(bytes32 _vksCommitment, uint256[] memory _blockInputs, bytes32 _oracleCommitment, uint256[] memory _subProofsLimbs) internal pure returns (uint256) {
        bytes memory concatenated = abi.encodePacked(_vksCommitment);
        for (uint256 i = 0; i < _blockInputs.length; ++i) {
            concatenated = abi.encodePacked(concatenated, _blockInputs[i]);
        }
        concatenated = abi.encodePacked(concatenated, _oracleCommitment);
        concatenated = abi.encodePacked(concatenated, _subProofsLimbs);
        console.logBytes(concatenated);

        bytes32 commitment = keccak256(concatenated);
        console.logBytes32(commitment);
        return uint256(commitment) & INPUT_MASK;
    }
}
