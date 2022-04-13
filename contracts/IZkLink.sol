// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./Governance.sol";

/// @title Interface of the ZKLink
/// @author zk.link
interface IZkLink {

    function governance() external returns (Governance);
}
