// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../bridge/LayerZeroBridge.sol";

/// @title A bridge upgrade version mock
/// @author zk.link
contract LayerZeroBridgeV2Mock is LayerZeroBridge {

    function version() external pure returns (uint8) {
        return 2;
    }
}
