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

    /// @notice LayerZero endpoint that used to send and receive message
    address public endpoint;
    /// @notice bridge contract address on other chains
    mapping(uint16 => bytes) public destinations;
    /// @notice address length on destination chains, default is 20(EVM chains)
    mapping(uint16 => uint8) public destAddressLength;
    /// @notice user applications
    mapping(APP => address) public apps;

    event UpdateDestination(uint16 lzChainId, bytes destination);
    event UpdateDestinationAddressLength(uint16 lzChainId, uint8 addressLength);
    event UpdateAPP(APP app, address contractAddress);

    modifier onlyEndpoint {
        require(msg.sender == endpoint, "Require endpoint");
        _;
    }
}
