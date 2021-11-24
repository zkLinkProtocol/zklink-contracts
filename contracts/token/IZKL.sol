// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma abicoder v2;

/// @title Interface of the ZKL token
/// @author ZkLink Labs
interface IZKL {

    function mint(address to, uint256 amount) external;
}
