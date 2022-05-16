// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Bytes.sol";
import "./zksync/Utils.sol";
import "./zksync/ReentrancyGuard.sol";
import "./zksync/Config.sol";
import "./zksync/SafeMath.sol";
import "./zksync/SafeCast.sol";
import "./zksync/Operations.sol";
import "./IZkLink.sol";
import "./PeripheryData.sol";

/// @title ZkLink periphery contract
/// @author zk.link
contract ZkLinkPeriphery is ReentrancyGuard, Config, PeripheryData {
    using SafeMath for uint256;

    /// @dev When set fee = 100, it means 1%
    uint16 internal constant MAX_WITHDRAW_FEE_RATE = 10000;

    /// @dev zkLink proxy address
    IZkLink public zkLink;

    /// @dev Accept infos of fast withdraw of account
    /// uint32 is the account id
    /// byte32 is keccak256(abi.encodePacked(receiver, tokenId, amount, withdrawFeeRate, nonce))
    /// address is the accepter
    mapping(uint32 => mapping(bytes32 => address)) public accepts;

    /// @dev Broker allowance used in accept
    mapping(uint16 => mapping(address => mapping(address => uint128))) internal brokerAllowances;

    enum ChangePubkeyType {ECRECOVER, CREATE2}

    /// @notice Event emitted when accepter accept a fast withdraw
    event Accept(address indexed accepter, uint32 indexed accountId, address receiver, uint16 tokenId, uint128 amountSent, uint128 amountReceive);

    /// @notice Event emitted when set broker allowance
    event BrokerApprove(uint16 indexed tokenId, address indexed owner, address indexed spender, uint128 amount);

    modifier onlyZkLink {
        require(msg.sender == address(zkLink), "ZP0");
        _;
    }

    function initialize(bytes calldata /**initializationParameters**/) external {
        initializeReentrancyGuard();
    }

    /// @notice Verifier contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    // solhint-disable-next-line no-empty-blocks
    function upgrade(bytes calldata upgradeParameters) external {}

    /// @notice Set the zkLink proxy address
    /// @dev MUST be called at once when deployed ZkLink
    function setZkLinkAddress(address _zkLink) external {
        if (_zkLink != address(0)) {
            zkLink = IZkLink(_zkLink);
        }
    }

    // =======================Periphery functions======================

    /// @dev Process one block commit using previous block StoredBlockInfo,
    /// returns new block StoredBlockInfo
    /// NOTE: Does not change storage (except events, so we can't mark it view)
    /// only ZkLink can call this function to add more security
    function commitOneBlock(StoredBlockInfo memory _previousBlock, CommitBlockInfo memory _newBlock) external onlyZkLink view returns (StoredBlockInfo memory storedNewBlock)
    {
        require(_newBlock.blockNumber == _previousBlock.blockNumber + 1, "ZP1");

        // Check timestamp of the new block
        {
            require(_newBlock.timestamp >= _previousBlock.timestamp, "ZP2");
            // MUST be in a range of [block.timestamp - COMMIT_TIMESTAMP_NOT_OLDER, block.timestamp + COMMIT_TIMESTAMP_APPROXIMATION_DELTA]
            require(block.timestamp.sub(COMMIT_TIMESTAMP_NOT_OLDER) <= _newBlock.timestamp &&
                _newBlock.timestamp <= block.timestamp.add(COMMIT_TIMESTAMP_APPROXIMATION_DELTA), "ZP3");
        }

        // Check onchain operations
        (bytes32 pendingOnchainOpsHash, uint64 priorityReqCommitted, bytes memory onchainOpsOffsetCommitment) =
        collectOnchainOps(_newBlock);

        // Create block commitment for verification proof
        bytes32 commitment = createBlockCommitment(_previousBlock, _newBlock, onchainOpsOffsetCommitment);

        return StoredBlockInfo(
            _newBlock.blockNumber,
            priorityReqCommitted,
            pendingOnchainOpsHash,
            _newBlock.timestamp,
            _newBlock.newStateHash,
            commitment
        );
    }

    /// @dev Gets operations packed in bytes array. Unpacks it and stores onchain operations.
    /// Priority operations must be committed in the same order as they are in the priority queue.
    /// NOTE: does not change storage! (only emits events)
    /// processableOperationsHash - hash of the all operations that needs to be executed  (Withdraws, ForcedExits, FullExits)
    /// priorityOperationsProcessed - number of priority operations processed in this block (Deposits, FullExits)
    /// offsetsCommitment - array where 1 is stored in chunk where onchainOperation begins and other are 0 (used in commitments)
    function collectOnchainOps(CommitBlockInfo memory _newBlockData)
    internal
    view
    returns (
        bytes32 processableOperationsHash,
        uint64 priorityOperationsProcessed,
        bytes memory offsetsCommitment
    )
    {
        bytes memory pubData = _newBlockData.publicData;

        // overflow is impossible
        uint64 uncommittedPriorityRequestsOffset = zkLink.firstPriorityRequestId() + zkLink.totalCommittedPriorityRequests();
        priorityOperationsProcessed = 0;
        bytes memory processableOperations = new bytes(0);

        // pubdata length must be a multiple of CHUNK_BYTES
        require(pubData.length % CHUNK_BYTES == 0, "ZP4");
        offsetsCommitment = new bytes(pubData.length / CHUNK_BYTES);

        for (uint256 i = 0; i < _newBlockData.onchainOperations.length; ++i) {
            OnchainOperationData memory onchainOpData = _newBlockData.onchainOperations[i];

            uint256 pubdataOffset = onchainOpData.publicDataOffset;
            require(pubdataOffset < pubData.length, "ZP5");
            require(pubdataOffset % CHUNK_BYTES == 0, "ZP6");
            uint256 chunkId = pubdataOffset / CHUNK_BYTES;
            require(offsetsCommitment[chunkId] == 0x00, "ZP7"); // offset commitment should be empty
            offsetsCommitment[chunkId] = bytes1(0x01);

            {
                // the chain id is the next byte after op type if exist
                // overflow is impossible
                uint256 chainIdOffset = pubdataOffset + 1;
                if (chainIdOffset >= pubData.length) {
                    break;
                }
                uint8 chainId = uint8(pubData[chainIdOffset]);
                // NOTE: we MUST ignore ops that are not part of the current chain
                if (chainId != CHAIN_ID) {
                    continue;
                }
            }

            Operations.OpType opType = Operations.OpType(uint8(pubData[pubdataOffset]));

            if (opType == Operations.OpType.Deposit) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, DEPOSIT_BYTES);
                Operations.Deposit memory op = Operations.readDepositPubdata(opPubData);
                Operations.checkPriorityOperation(op, zkLink.getPriorityRequest(uncommittedPriorityRequestsOffset + priorityOperationsProcessed));
                priorityOperationsProcessed++;
            } else if (opType == Operations.OpType.ChangePubKey) {
                bytes memory opPubData = Bytes.slice(pubData, pubdataOffset, CHANGE_PUBKEY_BYTES);
                Operations.ChangePubKey memory op = Operations.readChangePubKeyPubdata(opPubData);
                if (onchainOpData.ethWitness.length != 0) {
                    bool valid = verifyChangePubkey(onchainOpData.ethWitness, op);
                    require(valid, "ZP8");
                } else {
                    bool valid = zkLink.getAuthFact(op.owner, op.nonce) == keccak256(abi.encodePacked(op.pubKeyHash));
                    require(valid, "ZP9");
                }
            } else {
                bytes memory opPubData;

                if (opType == Operations.OpType.Withdraw) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, WITHDRAW_BYTES);
                } else if (opType == Operations.OpType.ForcedExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FORCED_EXIT_BYTES);
                } else if (opType == Operations.OpType.FullExit) {
                    opPubData = Bytes.slice(pubData, pubdataOffset, FULL_EXIT_BYTES);

                    Operations.FullExit memory fullExitData = Operations.readFullExitPubdata(opPubData);
                    Operations.checkPriorityOperation(fullExitData, zkLink.getPriorityRequest(uncommittedPriorityRequestsOffset + priorityOperationsProcessed));
                    priorityOperationsProcessed++;
                } else {
                    revert("ZkLink: unsupported op");
                }

                processableOperations = Utils.concat(processableOperations, opPubData);
            }
        }
        processableOperationsHash = keccak256(processableOperations);
    }

    /// @dev Creates block commitment from its data
    /// @dev _offsetCommitment - hash of the array where 1 is stored in chunk where onchainOperation begins and 0 for other chunks
    function createBlockCommitment(
        StoredBlockInfo memory _previousBlock,
        CommitBlockInfo memory _newBlockData,
        bytes memory _offsetCommitment
    ) internal pure returns (bytes32 commitment) {
        commitment = sha256(abi.encodePacked(
                uint256(_newBlockData.blockNumber),
                uint256(_newBlockData.feeAccount),
                _previousBlock.stateHash,
                _newBlockData.newStateHash,
                uint256(_newBlockData.timestamp),
                _newBlockData.publicData,
                _offsetCommitment
            ));
    }

    /// @notice Checks that change operation is correct
    function verifyChangePubkey(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool)
    {
        ChangePubkeyType changePkType = ChangePubkeyType(uint8(_ethWitness[0]));
        if (changePkType == ChangePubkeyType.ECRECOVER) {
            return verifyChangePubkeyECRECOVER(_ethWitness, _changePk);
        } else if (changePkType == ChangePubkeyType.CREATE2) {
            return verifyChangePubkeyCREATE2(_ethWitness, _changePk);
        } else {
            revert("ZkLink: incorrect changePkType");
        }
    }

    /// @notice Checks that signature is valid for pubkey change message
    function verifyChangePubkeyECRECOVER(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool)
    {
        (, bytes memory signature) = Bytes.read(_ethWitness, 1, 65); // offset is 1 because we skip type of ChangePubkey
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n60", // message len(60) = _pubKeyHash.len(20) + _nonce.len(4) + _accountId.len(4) + 32
                _changePk.pubKeyHash,
                _changePk.nonce,
                _changePk.accountId,
                bytes32(0)
            )
        );
        address recoveredAddress = Utils.recoverAddressFromEthSignature(signature, messageHash);
        return recoveredAddress == _changePk.owner;
    }

    /// @notice Checks that signature is valid for pubkey change message
    function verifyChangePubkeyCREATE2(bytes memory _ethWitness, Operations.ChangePubKey memory _changePk) internal pure returns (bool)
    {
        address creatorAddress;
        bytes32 saltArg; // salt arg is additional bytes that are encoded in the CREATE2 salt
        bytes32 codeHash;
        uint256 offset = 1; // offset is 1 because we skip type of ChangePubkey
        (offset, creatorAddress) = Bytes.readAddress(_ethWitness, offset);
        (offset, saltArg) = Bytes.readBytes32(_ethWitness, offset);
        (offset, codeHash) = Bytes.readBytes32(_ethWitness, offset);
        // salt from CREATE2 specification
        bytes32 salt = keccak256(abi.encodePacked(saltArg, _changePk.pubKeyHash));
        // Address computation according to CREATE2 definition: https://eips.ethereum.org/EIPS/eip-1014
        address recoveredAddress = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), creatorAddress, salt, codeHash))))
        );
        // This type of change pubkey can be done only once
        return recoveredAddress == _changePk.owner && _changePk.nonce == 0;
    }

    // =======================Fast withdraw and Accept======================

    function getAccepter(uint32 accountId, bytes32 hash) external view returns (address) {
        return accepts[accountId][hash];
    }

    /// @dev Only zkLink can set accepter
    function setAccepter(uint32 accountId, bytes32 hash, address accepter) external onlyZkLink {
        require(accepts[accountId][hash] == address(0), "ZP10");
        accepts[accountId][hash] = accepter;
    }

    /// @notice Accepter accept a eth fast withdraw, accepter will get a fee for profit
    /// @param accepter Accepter who accept a fast withdraw
    /// @param accountId Account that request fast withdraw
    /// @param receiver User receive token from accepter (the owner of withdraw operation)
    /// @param amount The amount of withdraw operation
    /// @param withdrawFeeRate Fast withdraw fee rate taken by accepter
    /// @param nonce Account nonce, used to produce unique accept info
    function acceptETH(address accepter,
        uint32 accountId,
        address payable receiver,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce) external payable nonReentrant {
        // ===Checks===
        uint16 tokenId = zkLink.governance().getTokenId(ETH_ADDRESS);
        (uint128 amountReceive, bytes32 hash, ) =
        _checkAccept(accepter, accountId, receiver, tokenId, amount, withdrawFeeRate, nonce);

        // ===Effects===
        accepts[accountId][hash] = accepter;

        // ===Interactions===
        // make sure msg value >= amountReceive
        uint256 amountReturn = msg.value.sub(amountReceive);
        // do not use send or call to make more security
        receiver.transfer(amountReceive);
        // if send too more eth then return back to msg sender
        if (amountReturn > 0) {
            // it's safe to use call to msg.sender and can send all gas left to it
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = msg.sender.call{value: amountReturn}("");
            require(success, "ZP11");
        }
        emit Accept(accepter, accountId, receiver, tokenId, amountReceive, amountReceive);
    }

    /// @notice Accepter accept a erc20 token fast withdraw, accepter will get a fee for profit
    /// @param accepter Accepter who accept a fast withdraw
    /// @param accountId Account that request fast withdraw
    /// @param receiver User receive token from accepter (the owner of withdraw operation)
    /// @param tokenId Token id
    /// @param amount The amount of withdraw operation
    /// @param withdrawFeeRate Fast withdraw fee rate taken by accepter
    /// @param nonce Account nonce, used to produce unique accept info
    /// @param amountTransfer Amount that transfer from accepter to receiver
    /// may be a litter larger than the amount receiver received
    function acceptERC20(address accepter,
        uint32 accountId,
        address receiver,
        uint16 tokenId,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce,
        uint128 amountTransfer) external nonReentrant {
        // ===Checks===
        (uint128 amountReceive, bytes32 hash, address tokenAddress) =
        _checkAccept(accepter, accountId, receiver, tokenId, amount, withdrawFeeRate, nonce);

        // ===Effects===
        accepts[accountId][hash] = accepter;

        // ===Interactions===
        // stack too deep
        uint128 amountSent;
        {
            address _accepter = accepter;
            address _receiver = receiver;
            uint256 receiverBalanceBefore = IERC20(tokenAddress).balanceOf(_receiver);
            uint256 accepterBalanceBefore = IERC20(tokenAddress).balanceOf(_accepter);
            IERC20(tokenAddress).transferFrom(_accepter, _receiver, amountTransfer);
            uint256 receiverBalanceAfter = IERC20(tokenAddress).balanceOf(_receiver);
            uint256 accepterBalanceAfter = IERC20(tokenAddress).balanceOf(_accepter);
            uint128 receiverBalanceDiff = SafeCast.toUint128(receiverBalanceAfter.sub(receiverBalanceBefore));
            require(receiverBalanceDiff >= amountReceive, "ZP12");
            amountReceive = receiverBalanceDiff;
            // amountSent may be larger than amountReceive when the token is a non standard erc20 token
            amountSent = SafeCast.toUint128(accepterBalanceBefore.sub(accepterBalanceAfter));
        }
        if (msg.sender != accepter) {
            require(brokerAllowance(tokenId, accepter, msg.sender) >= amountSent, "ZP13");
            brokerAllowances[tokenId][accepter][msg.sender] -= amountSent;
        }
        emit Accept(accepter, accountId, receiver, tokenId, amountSent, amountReceive);
    }

    function calAcceptHash(address receiver, uint16 tokenId, uint128 amount, uint16 withdrawFeeRate, uint32 nonce) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(receiver, tokenId, amount, withdrawFeeRate, nonce));
    }

    function brokerAllowance(uint16 tokenId, address owner, address spender) public view returns (uint128) {
        return brokerAllowances[tokenId][owner][spender];
    }

    /// @notice Give allowance to spender to call accept
    function brokerApprove(uint16 tokenId, address spender, uint128 amount) external returns (bool) {
        require(spender != address(0), "ZP14");
        brokerAllowances[tokenId][msg.sender][spender] = amount;
        emit BrokerApprove(tokenId, msg.sender, spender, amount);
        return true;
    }

    function _checkAccept(address accepter,
        uint32 accountId,
        address receiver,
        uint16 tokenId,
        uint128 amount,
        uint16 withdrawFeeRate,
        uint32 nonce) internal view returns (uint128 amountReceive, bytes32 hash, address tokenAddress) {
        // accepter and receiver MUST be set and MUST not be the same
        require(accepter != address(0), "ZP17");
        require(receiver != address(0), "ZP18");
        require(receiver != accepter, "ZP19");
        // token MUST be registered to ZkLink
        Governance.RegisteredToken memory rt = zkLink.governance().getToken(tokenId);
        require(rt.registered, "ZP20");
        tokenAddress = rt.tokenAddress;
        // feeRate MUST be valid
        amountReceive = amount * (MAX_WITHDRAW_FEE_RATE - withdrawFeeRate) / MAX_WITHDRAW_FEE_RATE;
        require(amountReceive > 0 && amountReceive <= amount, "ZP21");
        // nonce MUST not be zero
        require(nonce > 0, "ZP22");

        // accept tx may be later than block exec tx(with user withdraw op)
        hash = calAcceptHash(receiver, tokenId, amount, withdrawFeeRate, nonce);
        require(accepts[accountId][hash] == address(0), "ZP23");

        // zkLink MUST not be in exodus
        require(!zkLink.exodusMode(), "ZP24");
    }
}
