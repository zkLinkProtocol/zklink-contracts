// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IBridgeManager.sol";

/// @title Manager multi bridges
/// @author zk.link
contract BridgeManager is Ownable, IBridgeManager {

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

    event AddBridge(address indexed bridge);
    event UpdateBridge(uint256 indexed bridgeIndex, bool enableBridgeTo, bool enableBridgeFrom);

    /// @notice Add a new bridge
    /// @param bridge the bridge contract
    function addBridge(address bridge) external onlyOwner {
        // the index of non-exist bridge is zero
        require(bridgeIndex[bridge] == 0, "Bridge exist");

        BridgeInfo memory info = BridgeInfo({
            bridge: bridge,
            enableBridgeTo: true,
            enableBridgeFrom: true
        });
        bridges.push(info);
        bridgeIndex[bridge] = bridges.length;
        emit AddBridge(bridge);
    }

    /// @notice Update bridge info
    /// @dev If we want to remove a bridge(not compromised), we should firstly set `enableBridgeTo` to false
    /// and wait all messages received from this bridge and then set `enableBridgeFrom` to false.
    /// But when a bridge is compromised, we must set both `enableBridgeTo` and `enableBridgeFrom` to false immediately
    /// @param index the bridge info index
    /// @param enableBridgeTo if set to false, bridge to will be disabled
    /// @param enableBridgeFrom if set to false, bridge from will be disabled
    function updateBridge(uint256 index, bool enableBridgeTo, bool enableBridgeFrom) external onlyOwner {
        require(index < bridges.length, "Invalid index");
        BridgeInfo memory info = bridges[index];
        info.enableBridgeTo = enableBridgeTo;
        info.enableBridgeFrom = enableBridgeFrom;
        bridges[index] = info;
        emit UpdateBridge(index, enableBridgeTo, enableBridgeFrom);
    }

    function isBridgeToEnabled(address bridge) external view override returns (bool) {
        uint256 index = bridgeIndex[bridge] - 1;
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeTo;
    }

    function isBridgeFromEnabled(address bridge) external view override returns (bool) {
        uint256 index = bridgeIndex[bridge] - 1;
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeFrom;
    }
}
