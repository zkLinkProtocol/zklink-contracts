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

    function testCreatePairPubdata(Operations.CreatePair calldata _example, bytes calldata _pubdata) external pure {
        Operations.CreatePair memory parsed = Operations.readCreatePairPubdata(_pubdata);
        require(_example.accountId == parsed.accountId, "tok");
        require(_example.tokenAId == parsed.tokenAId, "tA");
        require(_example.tokenBId == parsed.tokenBId, "tB");
        require(_example.tokenPairId == parsed.tokenPairId, "tP");
        require(_example.pair == parsed.pair, "p");
    }

    function testWriteCreatePairPubdata(Operations.CreatePair calldata _example) external pure {
        bytes memory pubdata = Operations.writeCreatePairPubdataForPriorityQueue(_example);
        Operations.CreatePair memory parsed = Operations.readCreatePairPubdata(pubdata);
        require(0 == parsed.accountId, "acc");
        require(_example.tokenAId == parsed.tokenAId, "tA");
        require(_example.tokenBId == parsed.tokenBId, "tB");
        require(_example.tokenPairId == parsed.tokenPairId, "tP");
        require(_example.pair == parsed.pair, "p");
    }
}
