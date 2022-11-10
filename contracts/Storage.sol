// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Operations.sol";
import "./zksync/SafeMath.sol";
import "./zksync/SafeMathUInt128.sol";
import "./zksync/Config.sol";
import "./zksync/Verifier.sol";
import "./zksync/IERC20.sol";
import "./zksync/SafeCast.sol";

/// @title ZkLink storage contract
/// @dev Be carefully to change the order of variables
/// @author zk.link
contract Storage is Config {
    using SafeMath for uint256;
    using SafeMathUInt128 for uint128;

    // verifier(20 bytes) + totalBlocksExecuted(4 bytes) + firstPriorityRequestId(8 bytes) stored in the same slot

    /// @notice Verifier contract. Used to verify block proof and exit proof
    Verifier public verifier;

    /// @notice Total number of executed blocks i.e. blocks[totalBlocksExecuted] points at the latest executed block (block 0 is genesis)
    uint32 public totalBlocksExecuted;

    /// @notice First open priority request id
    uint64 public firstPriorityRequestId;

    // networkGovernor(20 bytes) + totalBlocksCommitted(4 bytes) + totalOpenPriorityRequests(8 bytes) stored in the same slot

    /// @notice The the owner of whole system
    address public networkGovernor;

    /// @notice Total number of committed blocks i.e. blocks[totalBlocksCommitted] points at the latest committed block
    uint32 public totalBlocksCommitted;

    /// @notice Total number of requests
    uint64 public totalOpenPriorityRequests;

    // periphery(20 bytes) + totalBlocksProven(4 bytes) + totalCommittedPriorityRequests(8 bytes) stored in the same slot

    /// @notice Periphery contract. Contains some auxiliary features
    address public periphery;

    /// @notice Total blocks proven.
    uint32 public totalBlocksProven;

    /// @notice Total number of committed requests.
    /// @dev Used in checks: if the request matches the operation on Rollup contract and if provided number of requests is not too big
    uint64 public totalCommittedPriorityRequests;

    /// @dev Used to safely call `delegatecall`, immutable state variables don't occupy storage slot
    address internal immutable self = address(this);

    // totalBlocksSynchronized(4 bytes) + exodusMode(1 bytes) stored in the same slot

    /// @dev Latest synchronized block height
    uint32 public totalBlocksSynchronized;

    /// @notice Flag indicates that exodus (mass exit) mode is triggered
    /// @notice Once it was raised, it can not be cleared again, and all users must exit
    bool public exodusMode;

    /// @dev Root-chain balances (per owner and token id, see packAddressAndTokenId) to withdraw
    /// @dev the amount of pending balance need to recovery decimals when withdraw
    mapping(bytes22 => uint128) internal pendingBalances;

    /// @notice Flag indicates that a user has exited a certain token balance in the exodus mode
    /// @dev The struct of this map is (accountId => subAccountId => withdrawTokenId => deductTokenId => performed)
    /// @dev withdrawTokenId is the token that withdraw to user in l1
    /// @dev deductTokenId is the token that deducted from user in l2
    mapping(uint32 => mapping(uint8 => mapping(uint16 => mapping(uint16 => bool)))) public performedExodus;

    /// @dev Priority Requests mapping (request id - operation)
    /// Contains op type, pubdata and expiration block of unsatisfied requests.
    /// Numbers are in order of requests receiving
    mapping(uint64 => Operations.PriorityOperation) internal priorityRequests;

    /// @notice User authenticated fact hashes for some nonce.
    mapping(address => mapping(uint32 => bytes32)) public authFacts;

    /// @dev Timer for authFacts entry reset (address, nonce -> timer).
    /// Used when user wants to reset `authFacts` for some nonce.
    mapping(address => mapping(uint32 => uint256)) internal authFactsResetTimer;

    /// @dev Stored hashed StoredBlockInfo for some block number
    mapping(uint32 => bytes32) internal storedBlockHashes;

    /// @dev if `synchronizedChains` | CHAIN_INDEX equals to `ALL_CHAINS` defined in `Config.sol` then blocks at `blockHeight` and before it can be executed
    // the key is the `syncHash` of `StoredBlockInfo`
    // the value is the `synchronizedChains` of `syncHash` collected from all other chains
    mapping(bytes32 => uint256) internal synchronizedChains;

    /// @dev Accept infos of fast withdraw of account
    /// uint32 is the account id
    /// byte32 is keccak256(abi.encodePacked(receiver, tokenId, amount, withdrawFeeRate, nonce))
    /// address is the accepter
    mapping(uint32 => mapping(bytes32 => address)) public accepts;

    /// @dev Broker allowance used in accept, accepter can authorize broker to do accept
    /// @dev Similar to the allowance of transfer in ERC20
    /// @dev The struct of this map is (tokenId => accepter => broker => allowance)
    mapping(uint16 => mapping(address => mapping(address => uint128))) internal brokerAllowances;

    /// @notice A set of permitted validators
    mapping(address => bool) public validators;

    struct RegisteredToken {
        bool registered; // whether token registered to ZkLink or not, default is false
        bool paused; // whether token can deposit to ZkLink or not, default is false
        address tokenAddress; // the token address
        uint8 decimals; // the token decimals of layer one
        bool standard; // we will not check the balance different of zkLink contract after transfer when a token comply with erc20 standard
    }

    /// @notice A map of registered token infos
    mapping(uint16 => RegisteredToken) public tokens;

    /// @notice A map of token address to id, 0 is invalid token id
    mapping(address => uint16) public tokenIds;

    /// @dev We can set `enableBridgeTo` and `enableBridgeTo` to false to disable bridge when `bridge` is compromised
    struct BridgeInfo {
        address bridge;
        bool enableBridgeTo;
        bool enableBridgeFrom;
    }

    /// @notice bridges
    BridgeInfo[] public bridges;
    // 0 is reversed for non-exist bridge, existing bridges are indexed from 1
    mapping(address => uint256) public bridgeIndex;

    /// @notice block stored data
    /// @dev `blockNumber`,`timestamp`,`stateHash`,`commitment` are the same on all chains
    /// `priorityOperations`,`pendingOnchainOperationsHash` is different for each chain
    struct StoredBlockInfo {
        uint32 blockNumber; // Rollup block number
        uint64 priorityOperations; // Number of priority operations processed
        bytes32 pendingOnchainOperationsHash; // Hash of all operations that must be processed after verify
        uint256 timestamp; // Rollup block timestamp, have the same format as Ethereum block constant
        bytes32 stateHash; // Root hash of the rollup state
        bytes32 commitment; // Verified input for the ZkLink circuit
        bytes32 syncHash; // Used for cross chain block verify
    }

    /// @notice Checks that current state not is exodus mode
    modifier active() {
        require(!exodusMode, "0");
        _;
    }

    /// @notice Checks that current state is exodus mode
    modifier notActive() {
        require(exodusMode, "1");
        _;
    }

    /// @notice Set logic contract must be called through proxy
    modifier onlyDelegateCall() {
        require(address(this) != self, "2");
        _;
    }

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, "3");
        _;
    }

    /// @notice Check if msg sender is a validator
    modifier onlyValidator() {
        require(validators[msg.sender], "4");
        _;
    }

    /// @notice Returns the keccak hash of the ABI-encoded StoredBlockInfo
    function hashStoredBlockInfo(StoredBlockInfo memory _storedBlockInfo) internal pure returns (bytes32) {
        return keccak256(abi.encode(_storedBlockInfo));
    }

    /// @notice Increase pending balance to withdraw
    /// @param _packedBalanceKey address tokenId packed key
    /// @param _amount pending amount that need to recovery decimals when withdraw
    function increaseBalanceToWithdraw(bytes22 _packedBalanceKey, uint128 _amount) internal {
        uint128 balance = pendingBalances[_packedBalanceKey];
        pendingBalances[_packedBalanceKey] = balance.add(_amount);
    }

    /// @notice Packs address and token id into single word to use as a key in balances mapping
    function packAddressAndTokenId(address _address, uint16 _tokenId) internal pure returns (bytes22) {
        return bytes22((uint176(_address) | (uint176(_tokenId) << 160)));
    }

    /// @notice Sends tokens
    /// @dev NOTE: will revert if transfer call fails or rollup balance difference (before and after transfer) is bigger than _maxAmount
    /// This function is used to allow tokens to spend zkLink contract balance up to amount that is requested
    /// @param _token Token address
    /// @param _to Address of recipient
    /// @param _amount Amount of tokens to transfer
    /// @param _maxAmount Maximum possible amount of tokens to transfer to this account
    /// @param _isStandard If token is a standard erc20
    /// @return withdrawnAmount The really amount than will be debited from user
    function transferERC20(IERC20 _token, address _to, uint128 _amount, uint128 _maxAmount, bool _isStandard) external returns (uint128 withdrawnAmount) {
        require(msg.sender == address(this), "n0"); // can be called only from this contract as one "external" call (to revert all this function state changes if it is needed)

        // most tokens are standard, fewer query token balance can save gas
        if (_isStandard) {
            _token.transfer(_to, _amount);
            return _amount;
        } else {
            uint256 balanceBefore = _token.balanceOf(address(this));
            _token.transfer(_to, _amount);
            uint256 balanceAfter = _token.balanceOf(address(this));
            uint256 balanceDiff = balanceBefore.sub(balanceAfter);
            require(balanceDiff > 0, "n1"); // transfer is considered successful only if the balance of the contract decreased after transfer
            require(balanceDiff <= _maxAmount, "n2"); // rollup balance difference (before and after transfer) is bigger than `_maxAmount`

            // It is safe to convert `balanceDiff` to `uint128` without additional checks, because `balanceDiff <= _maxAmount`
            return uint128(balanceDiff);
        }
    }

    /// @dev improve decimals when deposit, for example, user deposit 2 USDC in ui, and the decimals of USDC is 6
    /// the `_amount` params when call contract will be 2 * 10^6
    /// because all token decimals defined in layer two is 18
    /// so the `_amount` in deposit pubdata should be 2 * 10^6 * 10^(18 - 6) = 2 * 10^18
    function improveDecimals(uint128 _amount, uint8 _decimals) internal pure returns (uint128) {
        // overflow is impossible,  `_decimals` has been checked when register token
        return _amount.mul(SafeCast.toUint128(10**(TOKEN_DECIMALS_OF_LAYER2 - _decimals)));
    }

    /// @dev recover decimals when withdraw, this is the opposite of improve decimals
    function recoveryDecimals(uint128 _amount, uint8 _decimals) internal pure returns (uint128) {
        // overflow is impossible,  `_decimals` has been checked when register token
        return _amount.div(SafeCast.toUint128(10**(TOKEN_DECIMALS_OF_LAYER2 - _decimals)));
    }

    /// @notice Performs a delegatecall to the contract implementation
    /// @dev Fallback function allowing to perform a delegatecall to the given implementation
    /// This function will return whatever the implementation call returns
    function _fallback(address _target) internal {
        require(_target != address(0), "5");
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), _target, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
