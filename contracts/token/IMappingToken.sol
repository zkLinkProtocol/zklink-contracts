// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.7.0;

/// @title Interface of the Mapping token
/// @author zk.link
interface IMappingToken {

    /// @notice mint amount of token to receiver
    function mint(address receiver, uint256 amount) external;

    /// @notice burn amount of token from msg.sender
    function burn(uint256 amount) external;
}
