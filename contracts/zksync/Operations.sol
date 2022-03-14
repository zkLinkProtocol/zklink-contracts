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
        L1AddLQ, // 9 L1 Curve add Op
        QuickSwap, // 10 L1 Curve swap Op
        L1RemoveLQ, // 11 L1 Curve remove Op
        AddLiquidity, // 12 L2 Curve add Op
        Swap, // 13 L2 Curve swap Op
        RemoveLiquidity, // 14 L2 Curve remove Op
        OrderMatching // 15 L2 Order matching Op
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

    /// @notice Priority Operation container
    /// @member hashedPubData Hashed priority operation public data
    /// @member expirationBlock Expiration block number (ETH block) for this request (must be satisfied before)
    /// @member opType Priority operation type
    struct PriorityOperation {
        bytes20 hashedPubData;
        uint64 expirationBlock;
        OpType opType;
    }

    // Deposit pubdata
    struct Deposit {
        // uint8 opType
        uint8 chainId;
        uint32 accountId;
        uint16 tokenId;
        uint128 amount;
        address owner;
    }

    uint256 public constant PACKED_DEPOSIT_PUBDATA_BYTES =
        OP_TYPE_BYTES + CHAIN_BYTES + ACCOUNT_ID_BYTES + TOKEN_BYTES + AMOUNT_BYTES + ADDRESS_BYTES; // 44

    /// Deserialize deposit pubdata
    function readDepositPubdata(bytes memory _data) internal pure returns (Deposit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset); // chainId
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
            op.chainId, // chainId
            bytes4(0), // accountId (ignored) (update when ACCOUNT_ID_BYTES is changed)
            op.tokenId, // tokenId
            op.amount, // amount
            op.owner // owner
        );
    }

    /// @notice Checks that deposit is same as operation in priority queue
    /// @param _deposit Deposit data
    /// @param _priorityOperation Operation in priority queue
    function checkPriorityOperation(Deposit memory _deposit, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.Deposit, "Operations: Deposit Op Type"); // incorrect priority op type
        require(Utils.hashBytesToBytes20(writeDepositPubdataForPriorityQueue(_deposit)) == _priorityOperation.hashedPubData, "Operations: Deposit Hash");
    }

    // FullExit pubdata

    struct FullExit {
        // uint8 opType
        uint8 chainId;
        uint32 accountId;
        address owner;
        uint16 tokenId;
        uint128 amount;
    }

    uint256 public constant PACKED_FULL_EXIT_PUBDATA_BYTES =
        OP_TYPE_BYTES + CHAIN_BYTES + ACCOUNT_ID_BYTES + ADDRESS_BYTES + TOKEN_BYTES + AMOUNT_BYTES; // 44

    function readFullExitPubdata(bytes memory _data) internal pure returns (FullExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset); // chainId
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset); // accountId
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount

        require(offset == PACKED_FULL_EXIT_PUBDATA_BYTES, "O"); // reading invalid full exit pubdata size
    }

    function writeFullExitPubdataForPriorityQueue(FullExit memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.FullExit),
            op.chainId,
            op.accountId, // accountId
            op.owner, // owner
            op.tokenId, // tokenId
            uint128(0) // amount -- ignored
        );
    }

    /// @notice Checks that FullExit is same as operation in priority queue
    /// @param _fullExit FullExit data
    /// @param _priorityOperation Operation in priority queue
    function checkPriorityOperation(FullExit memory _fullExit, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.FullExit, "Operations: FullExit Op Type"); // incorrect priority op type
        require(Utils.hashBytesToBytes20(writeFullExitPubdataForPriorityQueue(_fullExit)) == _priorityOperation.hashedPubData, "Operations: FullExit Hash");
    }

    // PartialExit pubdata

    struct PartialExit {
        //uint8 opType; -- present in pubdata, ignored at serialization
        //uint32 accountId; -- present in pubdata, ignored at serialization
        uint16 tokenId;
        uint128 amount;
        //uint16 fee; -- present in pubdata, ignored at serialization
        address owner;
        uint32 nonce;
        bool isFastWithdraw;
        uint16 fastWithdrawFee;
    }

    uint256 public constant PACKED_PARTIAL_EXIT_PUBDATA_BYTES =
    OP_TYPE_BYTES + ACCOUNT_ID_BYTES + TOKEN_BYTES + AMOUNT_BYTES + FEE_BYTES + ADDRESS_BYTES + NONCE_BYTES + 1 + FEE_BYTES; // 52

    function readPartialExitPubdata(bytes memory _data) internal pure returns (PartialExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES + ACCOUNT_ID_BYTES; // opType + accountId (ignored)
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset); // tokenId
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset); // amount
        offset += FEE_BYTES; // fee (ignored)
        (offset, parsed.owner) = Bytes.readAddress(_data, offset); // owner
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset); // nonce
        (offset, parsed.isFastWithdraw) = Bytes.readBool(_data, offset); // isFastWithdraw
        (offset, parsed.fastWithdrawFee) = Bytes.readUInt16(_data, offset); // fastWithdrawFee

        require(offset == PACKED_PARTIAL_EXIT_PUBDATA_BYTES, "Operations: Read PartialExit");
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
    } // 49 bytes

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
    } // 53 bytes

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
        address to; // to address in to chain may be different with owner
        uint16 toTokenId;
        uint128 amountOutMin; // token min amount when swap
        uint128 amountOut; // token amount l2 swap out
        uint32 nonce;
        address pair; // l2 pair address
        uint16 acceptTokenId; // token user really want to receive
        uint128 acceptAmountOutMin; // token min user really want to receive
    }

    uint256 public constant PACKED_QUICK_SWAP_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * (CHAIN_BYTES + ADDRESS_BYTES + TOKEN_BYTES + AMOUNT_BYTES) +
    AMOUNT_BYTES + NONCE_BYTES + ADDRESS_BYTES + TOKEN_BYTES + AMOUNT_BYTES; // 137

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
        (offset, parsed.amountOut) = Bytes.readUInt128(_data, offset); // amountOut
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset); // nonce
        (offset, parsed.pair) = Bytes.readAddress(_data, offset); // pair
        (offset, parsed.acceptTokenId) = Bytes.readUInt16(_data, offset); // acceptTokenId
        (offset, parsed.acceptAmountOutMin) = Bytes.readUInt128(_data, offset); // acceptAmountOutMin

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
            uint128(0), // amountOut ignored
            op.nonce,
            op.pair,
            op.acceptTokenId
        );
        // to avoid Stack too deep error when compile
        buf = abi.encodePacked(buf, op.acceptAmountOutMin);
    }

    /// @notice Checks that quick swap is same as operation in priority queue
    /// @param _quickSwap Quick swap data
    /// @param _priorityOperation Operation in priority queue
    function checkPriorityOperation(QuickSwap memory _quickSwap, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.QuickSwap, "Operations: QuickSwap Op Type"); // incorrect priority op type
        require(Utils.hashBytesToBytes20(writeQuickSwapPubdataForPriorityQueue(_quickSwap)) == _priorityOperation.hashedPubData, "Operations: QuickSwap Hash");
    }

    // L1AddLQ pubdata
    struct L1AddLQ {
        // uint8 opType
        address owner;
        uint8 chainId;
        uint16 tokenId;
        uint128 amount;
        address pair; // l2 pair address
        uint128 minLpAmount; // l2 lp amount min received when add liquidity from l1 to l2
        uint128 lpAmount; // l2 pair lp amount really produced from l2 to l1, if lp amount is zero it means add liquidity failed
        uint32 nftTokenId;
    }

    uint256 public constant PACKED_L1ADDLQ_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * ADDRESS_BYTES + CHAIN_BYTES + TOKEN_BYTES + 3 * AMOUNT_BYTES + NFT_TOKEN_BYTES; // 96

    /// Deserialize pubdata
    function readL1AddLQPubdata(bytes memory _data) internal pure returns (L1AddLQ memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.pair) = Bytes.readAddress(_data, offset);
        (offset, parsed.minLpAmount) = Bytes.readUInt128(_data, offset);
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
            op.minLpAmount,
            uint128(0), // lp amount ignored
            op.nftTokenId
        );
    }

    /// @notice Checks that l1AddLQ is same as operation in priority queue
    /// @param _l1AddLQ L1AddLQ data
    /// @param _priorityOperation Operation in priority queue
    function checkPriorityOperation(Operations.L1AddLQ memory _l1AddLQ, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.L1AddLQ, "Operations: L1AddLQ Op Type"); // incorrect priority op type
        require(Utils.hashBytesToBytes20(writeL1AddLQPubdataForPriorityQueue(_l1AddLQ)) == _priorityOperation.hashedPubData, "Operations: L1AddLQ Hash");
    }

    // L1RemoveLQ pubdata
    struct L1RemoveLQ {
        // uint8 opType
        address owner; // token receiver after remove liquidity
        uint8 chainId;
        uint16 tokenId;
        uint128 minAmount; // l2 token amount min received when remove liquidity from l1 to l2
        uint128 amount; // l2 token amount really return back from l2 to l1, if amount is zero it means remove liquidity failed
        address pair; // l2 pair address
        uint128 lpAmount;
        uint32 nftTokenId;
    }

    uint256 public constant PACKED_L1REMOVELQ_PUBDATA_BYTES =
    OP_TYPE_BYTES + 2 * ADDRESS_BYTES + CHAIN_BYTES + TOKEN_BYTES + 3 * AMOUNT_BYTES + NFT_TOKEN_BYTES; // 96

    /// Deserialize pubdata
    function readL1RemoveLQPubdata(bytes memory _data) internal pure returns (L1RemoveLQ memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.minAmount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.pair) = Bytes.readAddress(_data, offset);
        (offset, parsed.lpAmount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.nftTokenId) = Bytes.readUInt32(_data, offset);

        require(offset == PACKED_L1REMOVELQ_PUBDATA_BYTES, "Operations: Read L1RemoveLQ");
    }

    /// Serialize pubdata
    function writeL1RemoveLQPubdataForPriorityQueue(L1RemoveLQ memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.L1RemoveLQ),
            op.owner,
            op.chainId,
            op.tokenId,
            op.minAmount,
            uint128(0),  // amount ignored
            op.pair,
            op.lpAmount,
            op.nftTokenId
        );
    }

    /// @notice Checks that l1RemoveLQ is same as operation in priority queue
    /// @param _l1RemoveLQ L1RemoveLQ data
    /// @param _priorityOperation Operation in priority queue
    function checkPriorityOperation(Operations.L1RemoveLQ memory _l1RemoveLQ, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.L1RemoveLQ, "Operations: L1RemoveLQ Op Type"); // incorrect priority op type
        require(Utils.hashBytesToBytes20(writeL1RemoveLQPubdataForPriorityQueue(_l1RemoveLQ)) == _priorityOperation.hashedPubData, "Operations: L1AddLQ Hash");
    }
}
