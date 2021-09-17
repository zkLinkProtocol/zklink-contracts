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
        Noop, // 0
        Deposit, // 1 L1 Op
        TransferToNew, // 2 L2 Op
        PartialExit, // 3 L2 Op
        _CloseAccount, // 4 used for correct op id offset
        Transfer, // 5 L2 Op
        FullExit, // 6 L1 Op
        ChangePubKey, // 7 L2 Op
        ForcedExit, // 8 L2 Op
        AddLiquidity, // 9 L2 Op
        RemoveLiquidity, // 10 L2 Op
        Swap, // 11 L2 Op
        QuickSwap, // 12 L1 Op
        Mapping, // 13 L1 Op
        L1AddLQ, // 14 L1 Op
        L1RemoveLQ // 15 L1 Op
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

    uint8 constant NFT_TOKEN_BYTES = 4;

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
        // amountOutMin has two meanings, the first refers to swap slippage of the from chain
        // and the second refers to the actual amountOut of the to chain
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
            uint128(0), // amountOutMin ignored
            op.withdrawFee,
            op.nonce
        );
    }

    /// @notice Write quick swap pubdata for priority queue check.
    function checkQuickSwapInPriorityQueue(QuickSwap memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeQuickSwapPubdataForPriorityQueue(op)) == hashedPubdata;
    }

    // Mapping pubdata
    struct Mapping {
        // uint8 opType
        uint8 fromChainId;
        uint8 toChainId;
        address owner;
        address to;
        uint16 tokenId;
        uint128 amount;
        uint128 fee; // present in pubdata, ignored at serialization
    }

    uint256 public constant PACKED_MAPPING_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * CHAIN_BYTES + 2 * ADDRESS_BYTES + TOKEN_BYTES + 2 * AMOUNT_BYTES;

    /// Deserialize mapping pubdata
    function readMappingPubdata(bytes memory _data) internal pure returns (Mapping memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.fromChainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.toChainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.to) = Bytes.readAddress(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.fee) = Bytes.readUInt128(_data, offset);

        require(offset == PACKED_MAPPING_PUBDATA_BYTES, "Operations: Read Mapping");
    }

    /// Serialize mapping pubdata
    function writeMappingPubdataForPriorityQueue(Mapping memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.Mapping),
            op.fromChainId,
            op.toChainId,
            op.owner,
            op.to,
            op.tokenId,
            op.amount,
            uint128(0) // fee (ignored)
        );
    }

    /// @notice Write mapping pubdata for priority queue check.
    function checkMappingInPriorityQueue(Mapping memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeMappingPubdataForPriorityQueue(op)) == hashedPubdata;
    }

    // L1AddLQ pubdata
    struct L1AddLQ {
        // uint8 opType
        address owner;
        uint8 chainId;
        uint16 tokenId;
        uint128 amount;
        address pair; // l2 pair address
        // lpAmount has two meanings:
        // l2 lp amount min received when add liquidity from l1 to l2
        // l2 pair lp amount really produced from l2 to l1, if lp amount is zero it means add liquidity failed
        uint128 lpAmount;
        uint32 nftTokenId;
    }

    uint256 public constant PACKED_L1ADDLQ_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * ADDRESS_BYTES + CHAIN_BYTES + TOKEN_BYTES + 2 * AMOUNT_BYTES + NFT_TOKEN_BYTES;

    /// Deserialize pubdata
    function readL1AddLQPubdata(bytes memory _data) internal pure returns (L1AddLQ memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.pair) = Bytes.readAddress(_data, offset);
        (offset, parsed.lpAmount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.nftTokenId) = Bytes.readUInt32(_data, offset);

        require(offset == PACKED_L1ADDLQ_PUBDATA_BYTES, "Operations: Read L1AddLQ");
    }

    /// Serialize pubdata
    function writeL1AddLQPubdataForPriorityQueue(L1AddLQ memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.L1AddLQ),
            op.owner,
            op.chainId,
            op.tokenId,
            op.amount,
            op.pair,
            uint128(0), // lp amount ignored
            op.nftTokenId
        );
    }

    /// @notice Write pubdata for priority queue check.
    function checkL1AddLQInPriorityQueue(L1AddLQ memory op, bytes20 hashedPubdata) internal pure returns (bool) {
        return Utils.hashBytesToBytes20(writeL1AddLQPubdataForPriorityQueue(op)) == hashedPubdata;
    }
}
