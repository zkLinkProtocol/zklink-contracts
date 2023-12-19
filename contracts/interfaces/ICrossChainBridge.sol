// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./ISyncService.sol";
import "./IEstimater.sol";

/// @title CrossChainBridge for sending cross chain message
/// @author zk.link
interface ICrossChainBridge is IEstimater,ISyncService{}
