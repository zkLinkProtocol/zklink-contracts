// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./CoinwindStrategy.sol";

contract BscCoinwindStrategy is CoinwindStrategy {

    constructor(uint16 _want, uint256 _pid) CoinwindStrategy(_want, _pid) {}

    /// @notice https://bscscan.com/token/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
    function weth() public override pure returns (address) {
        return address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    }

    /// @notice https://bscscan.com/address/0x52d22f040dee3027422e837312320b42e1fd737f
    function coinwind() public override pure returns (address) {
        return address(0x52d22F040dEE3027422e837312320b42e1fD737f);
    }

    /// @notice https://bscscan.com/token/0x422e3af98bc1de5a1838be31a56f75db4ad43730
    function cow() public override pure returns (address) {
        return address(0x422E3aF98bC1dE5a1838BE31A56f75DB4Ad43730);
    }

    /// @notice https://bscscan.com/token/0x9c65ab58d8d978db963e63f2bfb7121627e3a739
    function mdx() public override pure returns (address) {
        return address(0x9C65AB58d8d978DB963e63f2bfB7121627e3a739);
    }
}
