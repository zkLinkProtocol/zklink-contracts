// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./Bytes.sol";
import "./Utils.sol";

/// @title zkSync operations tools
library Operations {
    // Circuit ops and their pubdata (chunks * bytes)

    /// @notice zkSync circuit operation type
    enum OpType {
        Noop,
        Deposit,
        TransferToNew,
        PartialExit,
        _CloseAccount, // used for correct op id offset
        Transfer,
        FullExit,
        ChangePubKey,
        ForcedExit,
        CreatePair,
        AddLiquidity,
        RemoveLiquidity,
        Swap,
        QuickSwap
    }

    // Byte lengths

    uint8 constant OP_TYPE_BYTES = 1;

    uint8 constant CHAIN_BYTES = 1;

    uint8 constant TOKEN_BYTES = 2;

    uint8 constant PUBKEY_BYTES = 32;

    uint8 constant NONCE_BYTES = 4;

    uint8 constant PUBKEY_HASH_BYTES = 20;

    uint8 constant ADDRESS_BYTES = 20;

    /// @dev Packed fee bytes lengths
    uint8 constant FEE_BYTES = 2;

    /// @dev zkSync account id bytes lengths
    uint8 constant ACCOUNT_ID_BYTES = 4;

    uint8 constant AMOUNT_BYTES = 16;

    /// @dev Signature (for example full exit signature) bytes length
    uint8 constant SIGNATURE_BYTES = 64;

    // Deposit pubdata
    struct Deposit {
        // uint8 opType
        uint32 accountId;
        uint16 tokenId;
        uint128 amount;
        address owner;
    }

    uint256 public constant PACKED_DEPOSIT_PUBDATA_BYTES =
        OP_TYPE_BYTES + ACCOUNT_ID_BYTES + TOKEN_BYTES + AMOUNT_BYTES + ADDRESS_BYTES;

    /// Deserialize deposit pubdata
    function readDepositPubdata(bytes memory _data) internal pure returns (Deposit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset); // accountId
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner

        require(offset == PACKED_DEPOSIT_PUBDATA_BYTES, "N"); // reading invalid deposit pubdata size
    }

    /// Serialize deposit pubdata
    function writeDepositPubdataForPriorityQueue(Deposit memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.Deposit),
            bytes4(0), // accountId (ignored) (update when ACCOUNT_ID_BYTES is changed)
            op.tokenId, // tokenId
            op.amount, // amount
            op.owner // owner
        );
    }

    /// @notice Write deposit pubdata for priority queue check.
    function checkDepositInPriorityQueue(Deposit memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeDepositPubdataForPriorityQueue(op)) == hashedPubdata;
    }

    // FullExit pubdata

    struct FullExit {
        // uint8 opType
        uint32 accountId;
        address owner;
        uint16 tokenId;
        uint128 amount;
    }

    uint256 public constant PACKED_FULL_EXIT_PUBDATA_BYTES =
        OP_TYPE_BYTES + ACCOUNT_ID_BYTES + ADDRESS_BYTES + TOKEN_BYTES + AMOUNT_BYTES;

    function readFullExitPubdata(bytes memory _data) internal pure returns (FullExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset); // accountId
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount

        require(offset == PACKED_FULL_EXIT_PUBDATA_BYTES, "O"); // reading invalid full exit pubdata size
    }

    function writeFullExitPubdataForPriorityQueue(FullExit memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.FullExit),
            op.accountId, // accountId
            op.owner, // owner
            op.tokenId, // tokenId
            uint128(0) // amount -- ignored
        );
    }

    function checkFullExitInPriorityQueue(FullExit memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeFullExitPubdataForPriorityQueue(op)) == hashedPubdata;
    }

    // PartialExit pubdata

    struct PartialExit {
        //uint8 opType; -- present in pubdata, ignored at serialization
        //uint32 accountId; -- present in pubdata, ignored at serialization
        uint16 tokenId;
        uint128 amount;
        //uint16 fee; -- present in pubdata, ignored at serialization
        address owner;
    }

    function readPartialExitPubdata(bytes memory _data) internal pure returns (PartialExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES + ACCOUNT_ID_BYTES; // opType + accountId (ignored)
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount
        offset += FEE_BYTES; // fee (ignored)
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
    }

    // ForcedExit pubdata

    struct ForcedExit {
        //uint8 opType; -- present in pubdata, ignored at serialization
        //uint32 initiatorAccountId; -- present in pubdata, ignored at serialization
        //uint32 targetAccountId; -- present in pubdata, ignored at serialization
        uint16 tokenId;
        uint128 amount;
        //uint16 fee; -- present in pubdata, ignored at serialization
        address target;
    }

    function readForcedExitPubdata(bytes memory _data) internal pure returns (ForcedExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES + ACCOUNT_ID_BYTES * 2; // opType + initiatorAccountId + targetAccountId (ignored)
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount
        offset += FEE_BYTES; // fee (ignored)
        (offset, parsed.target) = Bytes.readAddress(_data, offset); // target
    }

    // ChangePubKey

    enum ChangePubkeyType {ECRECOVER, CREATE2, OldECRECOVER}

    struct ChangePubKey {
        // uint8 opType; -- present in pubdata, ignored at serialization
        uint32 accountId;
        bytes20 pubKeyHash;
        address owner;
        uint32 nonce;
        //uint16 tokenId; -- present in pubdata, ignored at serialization
        //uint16 fee; -- present in pubdata, ignored at serialization
    }

    function readChangePubKeyPubdata(bytes memory _data) internal pure returns (ChangePubKey memory parsed) {
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset); // accountId
        (offset, parsed.pubKeyHash) = Bytes.readBytes20(_data, offset); // pubKeyHash
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset); // nonce
    }

    // CreatePair

    struct CreatePair {
        // uint8 opType
        uint32 accountId;
        uint16 tokenAId;
        uint16 tokenBId;
        uint16 tokenPairId;
        address pair;
    }

    uint256 public constant PACKED_CREATE_PAIR_PUBDATA_BYTES =
    OP_TYPE_BYTES + ACCOUNT_ID_BYTES + TOKEN_BYTES * 3 + ADDRESS_BYTES;

    /// Deserialize CreatePair pubdata
    function readCreatePairPubdata(bytes memory _data) internal pure
    returns (CreatePair memory parsed)
    {
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset); // accountId
        (offset, parsed.tokenAId) = Bytes.readUInt16(_data, offset); // tokenAId
        (offset, parsed.tokenBId) = Bytes.readUInt16(_data, offset); // tokenBId
        (offset, parsed.tokenPairId) = Bytes.readUInt16(_data, offset); // tokenPairId
        (offset, parsed.pair) = Bytes.readAddress(_data, offset); // pair address

        require(offset == PACKED_CREATE_PAIR_PUBDATA_BYTES, "CP"); // reading invalid create pair pubdata size
    }

    /// Serialize CreatePair pubdata
    function writeCreatePairPubdataForPriorityQueue(CreatePair memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.CreatePair),
            bytes4(0), // accountId (ignored) (update when ACCOUNT_ID_BYTES is changed)
            op.tokenAId, // tokenAId
            op.tokenBId, // tokenBId
            op.tokenPairId, // tokenPairId
            op.pair // pair address
        );
    }

    /// @notice Write create pair pubdata for priority queue check.
    function checkCreatePairInPriorityQueue(CreatePair memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeCreatePairPubdataForPriorityQueue(op)) == hashedPubdata;
    }

    // QuickSwap pubdata
    struct QuickSwap {
        // uint8 opType
        uint8 fromChainId;
        uint8 toChainId;
        address owner;
        uint16 fromTokenId;
        uint128 amountIn;
        address to;
        uint16 toTokenId;
        uint128 amountOutMin;
        uint16 withdrawFee;
        uint32 nonce;
    }

    uint256 public constant PACKED_QUICK_SWAP_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * (CHAIN_BYTES + AMOUNT_BYTES + TOKEN_BYTES + ADDRESS_BYTES) + FEE_BYTES + NONCE_BYTES;

    /// Deserialize quick swap pubdata
    function readQuickSwapPubdata(bytes memory _data) internal pure returns (QuickSwap memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.fromChainId) = Bytes.readUint8(_data, offset); // fromChainId
        (offset, parsed.toChainId) = Bytes.readUint8(_data, offset); // toChainId
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
        (offset, parsed.fromTokenId) = Bytes.readUInt16(_data, offset); // fromTokenId
        (offset, parsed.amountIn) = Bytes.readUInt128(_data, offset); // amountIn
        (offset, parsed.to) = Bytes.readAddress(_data, offset); // to
        (offset, parsed.toTokenId) = Bytes.readUInt16(_data, offset); // toTokenId
        (offset, parsed.amountOutMin) = Bytes.readUInt128(_data, offset); // amountOutMin
        (offset, parsed.withdrawFee) = Bytes.readUInt16(_data, offset); // withdrawAmountOutMin
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset); // nonce

        require(offset == PACKED_QUICK_SWAP_PUBDATA_BYTES, "Operations: Read QuickSwap"); // reading invalid quick swap pubdata size
    }

    /// Serialize quick swap pubdata
    function writeQuickSwapPubdataForPriorityQueue(QuickSwap memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.QuickSwap),
            op.fromChainId,
            op.toChainId,
            op.owner,
            op.fromTokenId,
            op.amountIn,
            op.to,
            op.toTokenId,
            op.amountOutMin,
            op.withdrawFee,
            op.nonce
        );
    }

    /// @notice Write quick swap pubdata for priority queue check.
    function checkQuickSwapInPriorityQueue(QuickSwap memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeQuickSwapPubdataForPriorityQueue(op)) == hashedPubdata;
    }
}
