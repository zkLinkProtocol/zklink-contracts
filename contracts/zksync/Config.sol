// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

/// @title zkSync configuration constants
/// @author Matter Labs
contract Config {
    bytes32 internal constant EMPTY_STRING_KECCAK = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    /// @dev ERC20 tokens and ETH withdrawals gas limit, used only for complete withdrawals
    uint256 internal constant WITHDRAWAL_GAS_LIMIT = 100000;

    /// @dev Bytes in one chunk
    uint8 internal constant CHUNK_BYTES = 19;

    /// @dev Bytes of L2 PubKey hash
    uint8 internal constant PUBKEY_HASH_BYTES = 20;

    /// @dev Max amount of tokens registered in the network
    uint16 internal constant MAX_AMOUNT_OF_REGISTERED_TOKENS = 65535;

    /// @dev Max account id that could be registered in the network
    uint32 internal constant MAX_ACCOUNT_ID = $$((2**24) - 1);

    /// @dev Max sub account id that could be bound to account id
    uint8 internal constant MAX_SUB_ACCOUNT_ID = $$((2**3) - 1);

    /// @dev Expected average period of block creation
    uint256 internal constant BLOCK_PERIOD = $(BLOCK_PERIOD);

    /// @dev Operation chunks
    uint256 internal constant DEPOSIT_BYTES = 3 * CHUNK_BYTES;
    uint256 internal constant FULL_EXIT_BYTES = 3 * CHUNK_BYTES;
    uint256 internal constant WITHDRAW_BYTES = 3 * CHUNK_BYTES;
    uint256 internal constant FORCED_EXIT_BYTES = 3 * CHUNK_BYTES;
    uint256 internal constant CHANGE_PUBKEY_BYTES = 3 * CHUNK_BYTES;

    /// @dev Expiration delta for priority request to be satisfied (in seconds)
    /// @dev NOTE: Priority expiration should be > (EXPECT_VERIFICATION_IN * BLOCK_PERIOD)
    /// @dev otherwise incorrect block with priority op could not be reverted.
    uint256 internal constant PRIORITY_EXPIRATION_PERIOD = 14 days;

    /// @dev Expiration delta for priority request to be satisfied (in ETH blocks)
    uint256 internal constant PRIORITY_EXPIRATION =
        $(defined(PRIORITY_EXPIRATION) ? PRIORITY_EXPIRATION : PRIORITY_EXPIRATION_PERIOD / BLOCK_PERIOD);

    /// @dev Maximum number of priority request that wait to be proceed
    /// to prevent an attacker submit a large number of priority requests
    /// that exceeding the processing power of the l2 server
    /// and force the contract to enter exodus mode
    /// this attack may occur on some blockchains with high tps but low gas prices
    uint256 internal constant MAX_PRIORITY_REQUESTS = $(defined(MAX_PRIORITY_REQUESTS) ? MAX_PRIORITY_REQUESTS : 4096);

    /// @dev Reserved time for users to send full exit priority operation in case of an upgrade (in seconds)
    uint256 internal constant MASS_FULL_EXIT_PERIOD = 5 days;

    /// @dev Reserved time for users to withdraw funds from full exit priority operation in case of an upgrade (in seconds)
    uint256 internal constant TIME_TO_WITHDRAW_FUNDS_FROM_FULL_EXIT = 2 days;

    /// @dev Notice period before activation preparation status of upgrade mode (in seconds)
    /// @dev NOTE: we must reserve for users enough time to send full exit operation, wait maximum time for processing this operation and withdraw funds from it.
    uint256 internal constant UPGRADE_NOTICE_PERIOD =
        $(
            defined(UPGRADE_NOTICE_PERIOD)
            ? UPGRADE_NOTICE_PERIOD
            : MASS_FULL_EXIT_PERIOD + PRIORITY_EXPIRATION_PERIOD + TIME_TO_WITHDRAW_FUNDS_FROM_FULL_EXIT
        );

    /// @dev Timestamp - seconds since unix epoch
    uint256 internal constant COMMIT_TIMESTAMP_NOT_OLDER = 24 hours;

    /// @dev Maximum available error between real commit block timestamp and analog used in the verifier (in seconds)
    /// @dev Must be used cause miner's `block.timestamp` value can differ on some small value (as we know - 15 seconds)
    uint256 internal constant COMMIT_TIMESTAMP_APPROXIMATION_DELTA = 15 minutes;

    /// @dev Bit mask to apply for verifier public input before verifying.
    uint256 internal constant INPUT_MASK = $$(~uint256(0) >> 3);

    /// @dev Auth fact reset timelock
    uint256 internal constant AUTH_FACT_RESET_TIMELOCK = 1 days;

    /// @dev Max deposit of ERC20 token that is possible to deposit
    uint128 internal constant MAX_DEPOSIT_AMOUNT = $$((2**104) - 1);

    /// @dev Chain id defined by ZkLink
    uint8 internal constant CHAIN_ID = $(CHAIN_ID);

    /// @dev Min chain id defined by ZkLink
    uint8 internal constant MIN_CHAIN_ID = 1;

    /// @dev Max chain id defined by ZkLink
    uint8 internal constant MAX_CHAIN_ID = $(MAX_CHAIN_ID);

    /// @dev All chain index, for example [1, 2, 3, 4] => 1 << 0 | 1 << 1 | 1 << 2 | 1 << 3 = 15
    uint256 internal constant ALL_CHAINS = $(ALL_CHAINS);

    /// @dev Chain index, CHAIN_ID is non-zero value
    uint256 internal constant CHAIN_INDEX = $(1 << CHAIN_ID - 1);

    /// @dev Enable commit a compressed block
    bool internal constant ENABLE_COMMIT_COMPRESSED_BLOCK = $(ENABLE_COMMIT_COMPRESSED_BLOCK);

    /// @dev Address represent eth when deposit or withdraw
    address internal constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev When set fee = 100, it means 1%
    uint16 internal constant MAX_ACCEPT_FEE_RATE = 10000;

    /// @dev see EIP-712
    bytes32 internal constant CHANGE_PUBKEY_DOMAIN_SEPARATOR = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant CHANGE_PUBKEY_HASHED_NAME =  keccak256("ZkLink");
    bytes32 internal constant CHANGE_PUBKEY_HASHED_VERSION = keccak256("1");
    bytes32 internal constant CHANGE_PUBKEY_TYPE_HASH = keccak256("ChangePubKey(bytes20 pubKeyHash,uint32 nonce,uint32 accountId)");

    /// @dev Token decimals is a fixed value at layer two in ZkLink
    uint8 internal constant TOKEN_DECIMALS_OF_LAYER2 = 18;

    /// @dev Global asset account in the network
    /// @dev Can not deposit to or full exit this account
    uint32 internal constant GLOBAL_ASSET_ACCOUNT_ID = 1;
    address internal constant GLOBAL_ASSET_ACCOUNT_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    /// @dev USD and USD stable tokens defined by zkLink
    /// @dev User can deposit USD stable token(eg. USDC, BUSD) to get USD in layer two
    /// @dev And user also can full exit USD in layer two and get back USD stable tokens
    uint16 internal constant USD_TOKEN_ID = 1;
    uint16 internal constant MIN_USD_STABLE_TOKEN_ID = 17;
    uint16 internal constant MAX_USD_STABLE_TOKEN_ID = 31;
}
