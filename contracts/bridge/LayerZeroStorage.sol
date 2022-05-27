// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title LayerZero bridge storage
/// @author zk.link
/// @dev Do not initialize any variables of this contract
/// Do not break the alignment of contract storage
contract LayerZeroStorage {

    // evm address is 20 bytes
    uint8 constant internal EVM_ADDRESS_LENGTH = 20;

    enum APP {ZKL, ZKLINK}

    /// @notice ZkLink network governor
    address public networkGovernor;
    /// @notice LayerZero endpoint that used to send and receive message
    address public endpoint;
    /// @notice bridge contract address on other chains
    mapping(uint16 => bytes) public destinations;
    /// @notice address length on destination chains, default is 20(EVM chains)
    mapping(uint16 => uint8) public destAddressLength;
    /// @notice user applications
    mapping(APP => address) public apps;
    /// @notice failed message of lz non-blocking model
    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedMessages;

    event UpdateDestination(uint16 lzChainId, bytes destination);
    event UpdateDestinationAddressLength(uint16 lzChainId, uint8 addressLength);
    event UpdateAPP(APP app, address contractAddress);
    event MessageFailed(uint16 srcChainId, bytes srcAddress, uint64 nonce, bytes payload);

    modifier onlyEndpoint {
        require(msg.sender == endpoint, "Require endpoint");
        _;
    }
}
