// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../IStrategy.sol";
import "../IERC20.sol";

contract SimpleStrategy is IStrategy{

    uint256 constant MAX_BPS = 10000;

    address public override vault;
    address public token;
    uint16 public tokenId;
    uint256 public lossBip;

    constructor(address _vault, address _token, uint16 _tokenId, uint256 _lossBip) {
        vault = _vault;
        token = _token;
        tokenId = _tokenId;
        lossBip = _lossBip;
    }

    function totalAsset() override public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function want() override public view returns (uint16) {
        return tokenId;
    }

    function withdraw(uint256 amountNeeded) override external returns (uint256) {
        uint256 loss = lossBip * amountNeeded / MAX_BPS;
        IERC20(token).transfer(vault, amountNeeded - loss);
        if (loss > 0) {
            IERC20(token).transfer(address(0), loss);
        }
        return loss;
    }

    function migrate(address _newStrategy) override external {
        IERC20(token).transfer(_newStrategy, totalAsset());
    }
}
