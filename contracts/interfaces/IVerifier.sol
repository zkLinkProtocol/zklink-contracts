// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Verifier interface contract
/// @author zk.link
interface IVerifier {
    function verifyAggregatedBlockProof(uint256[] memory _recursiveInput, uint256[] memory _proof, uint8[] memory _vkIndexes, uint256[] memory _individualVksInputs, uint256[16] memory _subProofsLimbs) external returns (bool);

    function verifyExitProof(bytes32 _rootHash, uint8 _chainId, uint32 _accountId, uint8 _subAccountId, bytes32 _owner, uint16 _tokenId, uint16 _srcTokenId, uint128 _amount, uint256[] calldata _proof) external returns (bool);
}
