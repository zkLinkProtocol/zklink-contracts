// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FaucetToken is ERC20, Ownable {

    uint8 private _decimals;
    uint8 private _fromTransferFeeRatio;
    uint8 private _toTransferFeeRatio;

    constructor (string memory name,
        string memory symbol,
        uint8 decimals_,
        uint8 fromTransferFeeRatio_,
        uint8 toTransferFeeRatio_) ERC20(name, symbol) {
        _decimals = decimals_;
        _fromTransferFeeRatio = fromTransferFeeRatio_;
        _toTransferFeeRatio = toTransferFeeRatio_;
    }

    function mintTo(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._transfer(from, to, amount);

        if (from != address(0) && _fromTransferFeeRatio > 0) {
            // take fee of from
            _burn(from, amount / _fromTransferFeeRatio);
        }
        if (to != address(0) && _toTransferFeeRatio > 0) {
            // take fee of to
            _burn(to, amount / _toTransferFeeRatio);
        }
    }
}
