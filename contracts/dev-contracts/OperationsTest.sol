// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../zksync/Operations.sol";

contract OperationsTest {
    function testDepositPubdata(Operations.Deposit calldata _example, bytes calldata _pubdata) external pure {
        Operations.Deposit memory parsed = Operations.readDepositPubdata(_pubdata);
        require(_example.chainId == parsed.chainId, "cok");
        require(_example.accountId == parsed.accountId, "aok");
        require(_example.subAccountId == parsed.subAccountId, "sok");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testWriteDepositPubdata(Operations.Deposit calldata _example) external pure {
        bytes memory pubdata = Operations.writeDepositPubdataForPriorityQueue(_example);
        Operations.Deposit memory parsed = Operations.readDepositPubdata(pubdata);
        require(0 == parsed.accountId, "acc");
        require(_example.chainId == parsed.chainId, "cok");
        require(_example.subAccountId == parsed.subAccountId, "sok");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testWithdrawPubdata(Operations.Withdraw calldata _example, bytes calldata _pubdata) external pure {
        Operations.Withdraw memory parsed = Operations.readWithdrawPubdata(_pubdata);
        require(_example.chainId == parsed.chainId, "cok");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testFullExitPubdata(Operations.FullExit calldata _example, bytes calldata _pubdata) external pure {
        Operations.FullExit memory parsed = Operations.readFullExitPubdata(_pubdata);
        require(_example.chainId == parsed.chainId, "cid");
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.subAccountId == parsed.subAccountId, "scc");
        require(_example.owner == parsed.owner, "own");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(_example.amount == parsed.amount, "amn");
    }

    function testWriteFullExitPubdata(Operations.FullExit calldata _example) external pure {
        bytes memory pubdata = Operations.writeFullExitPubdataForPriorityQueue(_example);
        Operations.FullExit memory parsed = Operations.readFullExitPubdata(pubdata);
        require(_example.chainId == parsed.chainId, "cid");
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.subAccountId == parsed.subAccountId, "scc");
        require(_example.tokenId == parsed.tokenId, "tok");
        require(0 == parsed.amount, "amn");
        require(_example.owner == parsed.owner, "own");
    }

    function testForcedExitPubdata(Operations.ForcedExit calldata _example, bytes calldata _pubdata) external pure {
        Operations.ForcedExit memory parsed = Operations.readForcedExitPubdata(_pubdata);
        require(_example.chainId == parsed.chainId, "cid");
        require(_example.tokenId == parsed.tokenId, "tcc");
        require(_example.amount == parsed.amount, "amn");
        require(_example.target == parsed.target, "tar");
    }

    function testChangePubkeyPubdata(Operations.ChangePubKey calldata _example, bytes calldata _pubdata) external pure {
        Operations.ChangePubKey memory parsed = Operations.readChangePubKeyPubdata(_pubdata);
        require(_example.accountId == parsed.accountId, "acc");
        require(_example.pubKeyHash == parsed.pubKeyHash, "pkh");
        require(_example.owner == parsed.owner, "own");
        require(_example.nonce == parsed.nonce, "nnc");
    }
}
