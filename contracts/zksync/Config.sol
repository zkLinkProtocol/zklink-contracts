// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/// @title zkSync configuration constants
/// @author Matter Labs
contract Config {
    /// @dev Default fee address in state
    address public constant DEFAULT_FEE_ADDRESS = $(DEFAULT_FEE_ADDRESS);

    bytes32 internal constant EMPTY_STRING_KECCAK = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

    /// @dev Bytes in one chunk
    uint8 internal constant CHUNK_BYTES = 23;

    /// @dev Bytes of L2 PubKey hash
    uint8 internal constant PUBKEY_HASH_BYTES = 20;

    /// @dev Max amount of tokens registered in the network
    uint16 internal constant MAX_AMOUNT_OF_REGISTERED_TOKENS = 65535;

    /// @dev Max account id that could be registered in the network
    uint32 internal constant MAX_ACCOUNT_ID = $$((2**24) - 1);

    /// @dev Max sub account id that could be bound to account id
    uint8 internal constant MAX_SUB_ACCOUNT_ID = $$((2**5) - 1);

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

    /// @dev Max commitment produced in zk proof where highest 3 bits is 0
    uint256 internal constant MAX_PROOF_COMMITMENT = 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

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

    /// @dev Master chain id defined by ZkLink
    uint8 internal constant MASTER_CHAIN_ID = $(MASTER_CHAIN_ID);

    /// @dev NONE, ORIGIN, NEXUS
    uint8 internal constant SYNC_TYPE = $(SYNC_TYPE);
    uint8 internal constant SYNC_NONE = 0;
    uint8 internal constant SYNC_ORIGIN = 1;
    uint8 internal constant SYNC_NEXUS = 2;

    /// @dev Token decimals is a fixed value at layer two in ZkLink
    uint8 internal constant TOKEN_DECIMALS_OF_LAYER2 = 18;

    /// @dev The default fee account id
    uint32 internal constant DEFAULT_FEE_ACCOUNT_ID = 0;

    /// @dev Global asset account in the network
    /// @dev Can not deposit to or full exit this account
    uint32 internal constant GLOBAL_ASSET_ACCOUNT_ID = 1;
    bytes32 internal constant GLOBAL_ASSET_ACCOUNT_ADDRESS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    /// @dev USD and USD stable tokens defined by zkLink
    /// @dev User can deposit USD stable token(eg. USDC, BUSD) to get USD in layer two
    /// @dev And user also can full exit USD in layer two and get back USD stable tokens
    uint16 internal constant USD_TOKEN_ID = 1;
    uint16 internal constant MIN_USD_STABLE_TOKEN_ID = 17;
    uint16 internal constant MAX_USD_STABLE_TOKEN_ID = 31;
}
