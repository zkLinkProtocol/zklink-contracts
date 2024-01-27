// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title Verifier interface contract
/// @author zk.link
interface IVerifier {
    struct ProofInput {
        uint256[] proof;
        uint256[] blockInputs;
        uint256[] subProofsLimbs;
        bytes oracleContent;
    }

    function estimateVerifyFee(ProofInput memory _proof) external view returns (uint256 nativeFee);

    function verify(ProofInput memory _proof) external payable returns (bool);

    function verifyExitProof(bytes32 _rootHash, uint8 _chainId, uint32 _accountId, uint8 _subAccountId, bytes32 _owner, uint16 _tokenId, uint16 _srcTokenId, uint128 _amount, uint256[] calldata _proof) external view returns (bool);
}
