// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../Operations.sol";

contract OperationsTest {
    function testDepositPubdata(Operations.Deposit calldata _example, bytes calldata _pubdata) external pure {
        Operations.Deposit memory parsed = Operations.readDepositPubdata(_pubdata);
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testWriteDepositPubdata(Operations.Deposit calldata _example) external pure {
        bytes memory pubdata = Operations.writeDepositPubdataForPriorityQueue(_example);
        Operations.Deposit memory parsed = Operations.readDepositPubdata(pubdata);
        require(0 == parsed.accountId, "acc");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testPartialExitPubdata(Operations.PartialExit calldata _example, bytes calldata _pubdata) external pure {
        Operations.PartialExit memory parsed = Operations.readPartialExitPubdata(_pubdata);
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testFullExitPubdata(Operations.FullExit calldata _example, bytes calldata _pubdata) external pure {
        Operations.FullExit memory parsed = Operations.readFullExitPubdata(_pubdata);
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.owner == parsed.owner, "own");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
    }

    function testWriteFullExitPubdata(Operations.FullExit calldata _example) external pure {
        bytes memory pubdata = Operations.writeFullExitPubdataForPriorityQueue(_example);
        Operations.FullExit memory parsed = Operations.readFullExitPubdata(pubdata);
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(0 == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testChangePubkeyPubdata(Operations.ChangePubKey calldata _example, bytes calldata _pubdata) external pure {
        Operations.ChangePubKey memory parsed = Operations.readChangePubKeyPubdata(_pubdata);
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.pubKeyHash == parsed.pubKeyHash, "pkh");
        require(_example.owner == parsed.owner, "own");
        require(_example.nonce == parsed.nonce, "nnc");
    }

    function testQuickSwapPubdata(Operations.QuickSwap calldata _example, bytes calldata _pubdata) external pure {
        Operations.QuickSwap memory parsed = Operations.readQuickSwapPubdata(_pubdata);
        require(_example.fromChainId == parsed.fromChainId, "fromChainId");
        require(_example.toChainId == parsed.toChainId, "toChainId");
        require(_example.owner == parsed.owner, "owner");
        require(_example.fromTokenId == parsed.fromTokenId, "fromTokenId");
        require(_example.amountIn == parsed.amountIn, "amountIn");
        require(_example.to == parsed.to, "to");
        require(_example.toTokenId == parsed.toTokenId, "toTokenId");
        require(_example.amountOutMin == parsed.amountOutMin, "amountOutMin");
        require(_example.withdrawFee == parsed.withdrawFee, "withdrawAmountOutMin");
        require(_example.nonce == parsed.nonce, "nonce");
    }

    function testWriteQuickSwapPubdata(Operations.QuickSwap calldata _example) external pure {
        bytes memory pubdata = Operations.writeQuickSwapPubdataForPriorityQueue(_example);
        Operations.QuickSwap memory parsed = Operations.readQuickSwapPubdata(pubdata);
        require(_example.fromChainId == parsed.fromChainId, "fromChainId");
        require(_example.toChainId == parsed.toChainId, "toChainId");
        require(_example.owner == parsed.owner, "owner");
        require(_example.fromTokenId == parsed.fromTokenId, "fromTokenId");
        require(_example.amountIn == parsed.amountIn, "amountIn");
        require(_example.to == parsed.to, "to");
        require(_example.toTokenId == parsed.toTokenId, "toTokenId");
        require(0 == parsed.amountOutMin, "amountOutMin");
        require(_example.withdrawFee == parsed.withdrawFee, "withdrawAmountOutMin");
        require(_example.nonce == parsed.nonce, "nonce");
    }

    function testCreateMappingPubdata(Operations.Mapping calldata _example, bytes calldata _pubdata) external pure {
        Operations.Mapping memory parsed = Operations.readMappingPubdata(_pubdata);
        require(_example.fromChainId == parsed.fromChainId);
        require(_example.toChainId == parsed.toChainId);
        require(_example.owner == parsed.owner);
        require(_example.tokenId == parsed.tokenId);
        require(_example.amount == parsed.amount);
        require(_example.fee == parsed.fee);
        require(_example.nonce == parsed.nonce);
        require(_example.withdrawFee == parsed.withdrawFee);
    }

    function testWriteMappingPubdata(Operations.Mapping calldata _example) external pure {
        bytes memory pubdata = Operations.writeMappingPubdataForPriorityQueue(_example);
        Operations.Mapping memory parsed = Operations.readMappingPubdata(pubdata);
        require(_example.fromChainId == parsed.fromChainId);
        require(_example.toChainId == parsed.toChainId);
        require(_example.owner == parsed.owner);
        require(_example.tokenId == parsed.tokenId);
        require(_example.amount == parsed.amount);
        require(0 == parsed.fee);
        require(_example.nonce == parsed.nonce);
        require(_example.withdrawFee == parsed.withdrawFee);
    }

    function testCreateL1AddLQPubdata(Operations.L1AddLQ calldata _example, bytes calldata _pubdata) external pure {
        Operations.L1AddLQ memory parsed = Operations.readL1AddLQPubdata(_pubdata);
        require(_example.owner == parsed.owner);
        require(_example.chainId == parsed.chainId);
        require(_example.tokenId == parsed.tokenId);
        require(_example.amount == parsed.amount);
        require(_example.pair == parsed.pair);
        require(_example.lpAmount == parsed.lpAmount);
        require(_example.nftTokenId == parsed.nftTokenId);
    }

    function testWriteL1AddLQPubdata(Operations.L1AddLQ calldata _example) external pure {
        bytes memory pubdata = Operations.writeL1AddLQPubdataForPriorityQueue(_example);
        Operations.L1AddLQ memory parsed = Operations.readL1AddLQPubdata(pubdata);
        require(_example.owner == parsed.owner);
        require(_example.chainId == parsed.chainId);
        require(_example.tokenId == parsed.tokenId);
        require(_example.amount == parsed.amount);
        require(_example.pair == parsed.pair);
        require(0 == parsed.lpAmount);
        require(_example.nftTokenId == parsed.nftTokenId);
    }

    function testCreateL1RemoveLQPubdata(Operations.L1RemoveLQ calldata _example, bytes calldata _pubdata) external pure {
        Operations.L1RemoveLQ memory parsed = Operations.readL1RemoveLQPubdata(_pubdata);
        require(_example.owner == parsed.owner);
        require(_example.chainId == parsed.chainId);
        require(_example.tokenId == parsed.tokenId);
        require(_example.amount == parsed.amount);
        require(_example.pair == parsed.pair);
        require(_example.lpAmount == parsed.lpAmount);
        require(_example.nftTokenId == parsed.nftTokenId);
    }

    function testWriteL1RemoveLQPubdata(Operations.L1RemoveLQ calldata _example) external pure {
        bytes memory pubdata = Operations.writeL1RemoveLQPubdataForPriorityQueue(_example);
        Operations.L1RemoveLQ memory parsed = Operations.readL1RemoveLQPubdata(pubdata);
        require(_example.owner == parsed.owner);
        require(_example.chainId == parsed.chainId);
        require(_example.tokenId == parsed.tokenId);
        require(0 == parsed.amount);
        require(_example.pair == parsed.pair);
        require(_example.lpAmount == parsed.lpAmount);
        require(_example.nftTokenId == parsed.nftTokenId);
    }
}
