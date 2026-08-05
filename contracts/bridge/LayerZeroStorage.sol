// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILayerZeroEndpoint.sol";
import "../interfaces/IZkLink.sol";
import {Config} from "../zksync/Config.sol";

/// @title LayerZero bridge storage
/// @author zk.link
/// @dev Do not initialize any variables of this contract
/// Do not break the alignment of contract storage
contract LayerZeroStorage is Config {
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

    // ============================================================================
    // === LZ adapterParams fix (2026-08-05) — APPEND-ONLY, keep at end of storage ===
    // Reason: LayerZero deprecated the ULNv2 relayer (2026-08-03); the new Executor
    // model rejects empty adapterParams (revert 0x6592671c). We must send a non-empty
    // type-1 adapterParams carrying the destination lzReceive gas. This mapping holds
    // that per-destination gas, set by governor.
    // ============================================================================
    /// @notice lz chainId => min gas for lzReceive on the destination chain.
    /// @dev used to build LayerZero v1 type-1 adapterParams: abi.encodePacked(uint16(1), gas)
    mapping(uint16 => uint) public minDstGasLookup;

    event UpdateDestination(uint8 zkLinkChainId, uint16 lzChainId, bytes destination);
    event MessageFailed(uint16 srcChainId, bytes srcAddress, uint64 nonce, bytes payload);
    event SetMinDstGas(uint16 lzChainId, uint minDstGas); // LZ adapterParams fix
}
