// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILayerZeroEndpoint.sol";
import "../interfaces/IZkLink.sol";

/// @title LayerZero bridge storage
/// @author zk.link
/// @dev Do not initialize any variables of this contract
/// Do not break the alignment of contract storage
contract LayerZeroStorage {
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

    event UpdateDestination(uint8 zkLinkChainId, uint16 lzChainId, bytes destination);
    event MessageFailed(uint16 srcChainId, bytes srcAddress, uint64 nonce, bytes payload);
}
