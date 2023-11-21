// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILayerZeroEndpoint.sol";
import "../interfaces/IZkLink.sol";

/// @title LayerZero bridge storage
/// @author zk.link
/// @dev Do not initialize any variables of this contract
/// Do not break the alignment of contract storage
contract LayerZeroStorage {
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

    /// @notice zklink contract address
    IZkLink public zklink;
    /// @notice LayerZero endpoint that used to send and receive message
    ILayerZeroEndpoint public endpoint;
    /// @notice zkLink chainId => lz chainId
    mapping(uint8 => uint16) public zkLinkChainIdToLZChainId;
    /// @notice lz chainId => zkLink chainId
    mapping(uint16 => uint8) public lzChainIdToZKLinkChainId;
    /// @notice bridge contract address on other chains
    mapping(uint16 => bytes) public destinations;
    /// @notice failed message of lz non-blocking model
    /// @dev the struct of failedMessages is (srcChainId => srcAddress => nonce => payloadHash)
    /// srcChainId is the id of message source chain
    /// srcAddress is the trust remote address on the source chain who send message
    /// nonce is inbound message nonce
    /// payLoadHash is the keccak256 of message payload
    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedMessages;

    event UpdateChainIdMap(uint8 zkLinkChainId, uint16 lzChainId);
    event UpdateDestination(uint16 indexed lzChainId, bytes destination);
    event MessageFailed(uint16 indexed srcChainId, bytes srcAddress, uint64 nonce, bytes payload);
    event SynchronizationFee(uint256 fee);
}
