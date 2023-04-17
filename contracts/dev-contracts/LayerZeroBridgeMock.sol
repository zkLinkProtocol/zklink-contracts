// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../bridge/LayerZeroBridge.sol";

/// @title A lz bridge mock
/// @author zk.link
contract LayerZeroBridgeMock is LayerZeroBridge {

    constructor(address _governor, address _zklink, ILayerZeroEndpoint _endpoint) LayerZeroBridge(_governor, _zklink, _endpoint) {
    }

    function setEndpoint(ILayerZeroEndpoint newEndpoint) external onlyGovernor {
        endpoint = newEndpoint;
    }
}
