// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./Bytes.sol";
import "./Utils.sol";

/// @title zkSync operations tools
/// @dev Circuit ops and their pubdata (chunks * bytes)
library Operations {
    /// @dev zkSync circuit operation type
    enum OpType {
        Noop, // 0
        Deposit, // 1 L1 Op
        TransferToNew, // 2 L2 Op
        Withdraw, // 3 L2 Op
        Transfer, // 4 L2 Op
        FullExit, // 5 L1 Op
        ChangePubKey, // 6 L2 Op
        ForcedExit, // 7 L2 Op
        OrderMatching // 8 L2 Op
    }

    // Byte lengths

    /// @dev op is uint8
    uint8 internal constant OP_TYPE_BYTES = 1;

    /// @dev chainId is uint8
    uint8 internal constant CHAIN_BYTES = 1;

    /// @dev token is uint16
    uint8 internal constant TOKEN_BYTES = 2;

    /// @dev nonce is uint32
    uint8 internal constant NONCE_BYTES = 4;

    /// @dev address is 20 bytes length
    uint8 internal constant ADDRESS_BYTES = 20;

    /// @dev address prefix zero bytes length
    uint8 internal constant ADDRESS_PREFIX_ZERO_BYTES = 12;

    /// @dev fee is uint16
    uint8 internal constant FEE_BYTES = 2;

    /// @dev accountId is uint32
    uint8 internal constant ACCOUNT_ID_BYTES = 4;

    /// @dev subAccountId is uint8
    uint8 internal constant SUB_ACCOUNT_ID_BYTES = 1;

    /// @dev amount is uint128
    uint8 internal constant AMOUNT_BYTES = 16;

    // Priority operations: Deposit, FullExit
    struct PriorityOperation {
        bytes20 hashedPubData; // hashed priority operation public data
        uint64 expirationBlock; // expiration block number (ETH block) for this request (must be satisfied before)
        OpType opType; // priority operation type
    }

    struct Deposit {
        // uint8 opType
        uint8 chainId; // deposit from which chain that identified by l2 chain id
        uint32 accountId; // the account id bound to the owner address, ignored at serialization and will be set when the block is submitted
        uint8 subAccountId; // the sub account is bound to account, default value is 0(the global public sub account)
        uint16 tokenId; // the token that registered to l2
        uint16 targetTokenId; // the token that user increased in l2
        uint128 amount; // the token amount deposited to l2
        bytes32 owner; // the address that receive deposited token at l2
    } // 59

    /// @dev Deserialize deposit pubdata
    function readDepositPubdata(bytes memory _data) internal pure returns (Deposit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset);
        (offset, parsed.subAccountId) = Bytes.readUint8(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.targetTokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        (offset, parsed.owner) = Bytes.readBytes32(_data, offset);
    }

    /// @dev Serialize deposit pubdata
    function writeDepositPubdataForPriorityQueue(Deposit memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.Deposit),
            op.chainId,
            uint32(0), // accountId (ignored during hash calculation)
            op.subAccountId,
            op.tokenId,
            op.targetTokenId,
            op.amount,
            op.owner
        );
    }

    /// @dev Checks that deposit is same as operation in priority queue
    function checkPriorityOperation(Deposit memory _deposit, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.Deposit, "OP: not deposit");
        require(Utils.hashBytesToBytes20(writeDepositPubdataForPriorityQueue(_deposit)) == _priorityOperation.hashedPubData, "OP: invalid deposit hash");
    }

    struct FullExit {
        // uint8 opType
        uint8 chainId; // withdraw to which chain that identified by l2 chain id
        uint32 accountId; // the account id to withdraw from
        uint8 subAccountId; // the sub account is bound to account, default value is 0(the global public sub account)
        //bytes12 addressPrefixZero; -- address bytes length in l2 is 32
        address owner; // the address that own the account at l2
        uint16 tokenId; // the token that withdraw to l1
        uint16 srcTokenId; // the token that deducted in l2
        uint128 amount; // the token amount that fully withdrawn to owner, ignored at serialization and will be set when the block is submitted
    } // 59

    /// @dev Deserialize fullExit pubdata
    function readFullExitPubdata(bytes memory _data) internal pure returns (FullExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset);
        (offset, parsed.subAccountId) = Bytes.readUint8(_data, offset);
        offset += ADDRESS_PREFIX_ZERO_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.srcTokenId) = Bytes.readUInt16(_data, offset);
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
    }

    /// @dev Serialize fullExit pubdata
    function writeFullExitPubdataForPriorityQueue(FullExit memory op) internal pure returns (bytes memory buf) {
        buf = abi.encodePacked(
            uint8(OpType.FullExit),
            op.chainId,
            op.accountId,
            op.subAccountId,
            bytes12(0), // append 12 zero bytes
            op.owner,
            op.tokenId,
            op.srcTokenId,
            uint128(0) // amount(ignored during hash calculation)
        );
    }

    /// @dev Checks that FullExit is same as operation in priority queue
    function checkPriorityOperation(FullExit memory _fullExit, PriorityOperation memory _priorityOperation) internal pure {
        require(_priorityOperation.opType == Operations.OpType.FullExit, "OP: not fullExit");
        require(Utils.hashBytesToBytes20(writeFullExitPubdataForPriorityQueue(_fullExit)) == _priorityOperation.hashedPubData, "OP: invalid fullExit hash");
    }

    struct Withdraw {
        //uint8 opType; -- present in pubdata, ignored at serialization
        uint8 chainId; // which chain the withdraw happened
        uint32 accountId; // the account id to withdraw from
        uint8 subAccountId; // the sub account id to withdraw from
        uint16 tokenId; // the token that to withdraw
        //uint16 srcTokenId; -- the token that decreased in l2, present in pubdata, ignored at serialization
        uint128 amount; // the token amount to withdraw
        //uint16 fee; -- present in pubdata, ignored at serialization
        //bytes12 addressPrefixZero; -- address bytes length in l2 is 32
        address owner; // the address to receive token
        uint32 nonce; // zero means normal withdraw, not zero means fast withdraw and the value is the sub account nonce
        uint16 fastWithdrawFeeRate; // fast withdraw fee rate taken by acceptor
        uint8 fastWithdraw; // when this flag is 1, it means fast withdrawal
    } // 68

    function readWithdrawPubdata(bytes memory _data) internal pure returns (Withdraw memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset);
        (offset, parsed.subAccountId) = Bytes.readUint8(_data, offset);
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        offset += TOKEN_BYTES;
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        offset += FEE_BYTES;
        offset += ADDRESS_PREFIX_ZERO_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset);
        (offset, parsed.fastWithdrawFeeRate) = Bytes.readUInt16(_data, offset);
        (offset, parsed.fastWithdraw) = Bytes.readUint8(_data, offset);
    }

    struct ForcedExit {
        //uint8 opType; -- present in pubdata, ignored at serialization
        uint8 chainId; // which chain the force exit happened
        uint32 initiatorAccountId; // the account id of initiator
        uint8 initiatorSubAccountId; // the sub account id of initiator
        uint32 initiatorNonce; // the sub account nonce of initiator,  zero means normal withdraw, not zero means fast withdraw
        uint32 targetAccountId; // the account id of target
        //uint8 targetSubAccountId; -- present in pubdata, ignored at serialization
        uint16 tokenId; // the token that to withdraw
        //uint16 srcTokenId; -- the token that decreased in l2, present in pubdata, ignored at serialization
        uint128 amount; // the token amount to withdraw
        //bytes12 addressPrefixZero; -- address bytes length in l2 is 32
        address target; // the address to receive token
    } // 68 bytes

    function readForcedExitPubdata(bytes memory _data) internal pure returns (ForcedExit memory parsed) {
        // NOTE: there is no check that variable sizes are same as constants (i.e. TOKEN_BYTES), fix if possible.
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.initiatorAccountId) = Bytes.readUInt32(_data, offset);
        (offset, parsed.initiatorSubAccountId) = Bytes.readUint8(_data, offset);
        (offset, parsed.initiatorNonce) = Bytes.readUInt32(_data, offset);
        (offset, parsed.targetAccountId) = Bytes.readUInt32(_data, offset);
        offset += SUB_ACCOUNT_ID_BYTES;
        (offset, parsed.tokenId) = Bytes.readUInt16(_data, offset);
        offset += TOKEN_BYTES;
        (offset, parsed.amount) = Bytes.readUInt128(_data, offset);
        offset += ADDRESS_PREFIX_ZERO_BYTES;
        (offset, parsed.target) = Bytes.readAddress(_data, offset);
    }

    // ChangePubKey
    struct ChangePubKey {
        // uint8 opType; -- present in pubdata, ignored at serialization
        uint8 chainId; // which chain to verify(only one chain need to verify for gas saving)
        uint32 accountId; // the account that to change pubkey
        //uint8 subAccountId; -- present in pubdata, ignored at serialization
        bytes20 pubKeyHash; // hash of the new rollup pubkey
        //bytes12 addressPrefixZero; -- address bytes length in l2 is 32
        address owner; // the owner that own this account
        uint32 nonce; // the account nonce
        //uint16 tokenId; -- present in pubdata, ignored at serialization
        //uint16 fee; -- present in pubdata, ignored at serialization
    } // 67 bytes

    function readChangePubKeyPubdata(bytes memory _data) internal pure returns (ChangePubKey memory parsed) {
        uint256 offset = OP_TYPE_BYTES;
        (offset, parsed.chainId) = Bytes.readUint8(_data, offset);
        (offset, parsed.accountId) = Bytes.readUInt32(_data, offset);
        offset += SUB_ACCOUNT_ID_BYTES;
        (offset, parsed.pubKeyHash) = Bytes.readBytes20(_data, offset);
        offset += ADDRESS_PREFIX_ZERO_BYTES;
        (offset, parsed.owner) = Bytes.readAddress(_data, offset);
        (offset, parsed.nonce) = Bytes.readUInt32(_data, offset);
    }
}
