// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

/**
 * @dev Interface of the Mapping token.
 */
interface IMappingToken {

    /// @notice mint amount of token to receiver
    function mint(address receiver, uint256 amount) external returns (bool);

    /// @notice burn amount of token from msg.sender
    function burn(uint256 amount) external returns (bool);
}
