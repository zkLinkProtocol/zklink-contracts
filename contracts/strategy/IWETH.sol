// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

/// @notice interface come from contract address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) in eth main net
/// bsc WBNB contract address: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
/// heco WHT contract address: 0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f
/// WETH, WBNB and WHT has the same interface
interface IWETH {

    function deposit() external payable;

    function withdraw(uint256) external;
}
