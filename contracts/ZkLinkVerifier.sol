// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/KeysWithPlonkVerifier.sol";
import "./zksync/ReentrancyGuard.sol";
import "./zksync/Events.sol";
import "./Storage.sol";

/// @title ZkLink verifier contract
/// @author zk.link
contract ZkLinkVerifier is ReentrancyGuard, Storage, Events, KeysWithPlonkVerifier, KeysWithPlonkVerifierOld {

    /// @notice Recursive proof input data (individual commitments are constructed onchain)
    struct ProofInput {
        uint256[] recursiveInput;
        uint256[] proof;
        uint256[] commitments;
        uint8[] vkIndexes;
        uint256[16] subproofsLimbs;
    }

    // =================Verifier interface=================

    /// @notice Blocks commitment verification.
    /// @dev Only verifies block commitments without any other processing
    function proveBlocks(StoredBlockInfo[] memory _committedBlocks, ProofInput memory _proof) external nonReentrant {
        // ===Checks===
        uint32 currentTotalBlocksProven = totalBlocksProven;
        for (uint256 i = 0; i < _committedBlocks.length; ++i) {
            require(hashStoredBlockInfo(_committedBlocks[i]) == storedBlockHashes[currentTotalBlocksProven + 1], "x0");
            ++currentTotalBlocksProven;

            require(_proof.commitments[i] & INPUT_MASK == uint256(_committedBlocks[i].commitment) & INPUT_MASK, "x1");
        }

        // ===Effects===
        require(currentTotalBlocksProven <= totalBlocksCommitted, "x2");
        totalBlocksProven = currentTotalBlocksProven;

        // ===Interactions===
        bool success = verifyAggregatedBlockProof(
            _proof.recursiveInput,
            _proof.proof,
            _proof.vkIndexes,
            _proof.commitments,
            _proof.subproofsLimbs
        );
        require(success, "x3");
    }

    /// @notice Withdraws token from ZkLink to root chain in case of exodus mode. User must provide proof that he owns funds
    /// @param _storedBlockInfo Last verified block
    /// @param _owner Owner of the account
    /// @param _accountId Id of the account in the tree
    /// @param _subAccountId Id of the subAccount in the tree
    /// @param _proof Proof
    /// @param _tokenId The token want to withdraw
    /// @param _amount Amount for owner (must be total amount, not part of it)
    function performExodus(
        StoredBlockInfo calldata _storedBlockInfo,
        address _owner,
        uint32 _accountId,
        uint8 _subAccountId,
        uint16 _tokenId,
        uint128 _amount,
        uint256[] calldata _proof
    ) external notActive {
        // ===Checks===
        // performed exodus MUST not be already exited
        require(!performedExodus[_accountId][_subAccountId][_tokenId], "y0");
        // incorrect stored block info
        require(storedBlockHashes[totalBlocksExecuted] == hashStoredBlockInfo(_storedBlockInfo), "y1");
        // exit proof MUST be correct
        bool proofCorrect = verifyExitProof(_storedBlockInfo.stateHash, CHAIN_ID, _accountId, _subAccountId, _owner, _tokenId, _amount, _proof);
        require(proofCorrect, "y2");

        // ===Effects===
        performedExodus[_accountId][_subAccountId][_tokenId] = true;
        bytes22 packedBalanceKey = packAddressAndTokenId(_owner, _tokenId);
        increaseBalanceToWithdraw(packedBalanceKey, _amount);
        emit WithdrawalPending(_tokenId, _owner, _amount);
    }

    function verifyAggregatedBlockProof(
        uint256[] memory _recursiveInput,
        uint256[] memory _proof,
        uint8[] memory _vkIndexes,
        uint256[] memory _individualVksInputs,
        uint256[16] memory _subProofsLimbs
    ) internal view virtual returns (bool) {
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

    function verifyExitProof(
        bytes32 _rootHash,
        uint8 _chainId,
        uint32 _accountId,
        uint8 _subAccountId,
        address _owner,
        uint16 _tokenId,
        uint128 _amount,
        uint256[] calldata _proof
    ) internal view virtual returns (bool) {
        bytes32 commitment = sha256(abi.encodePacked(_rootHash, _chainId, _accountId, _subAccountId, _owner, _tokenId, _amount));

        uint256[] memory inputs = new uint256[](1);
        inputs[0] = uint256(commitment) & INPUT_MASK;
        ProofOld memory proof = deserialize_proof_old(inputs, _proof);
        VerificationKeyOld memory vk = getVkExit();
        require(vk.num_inputs == inputs.length, "z");
        return verify_old(proof, vk);
    }
}
