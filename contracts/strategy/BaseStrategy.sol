// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../IStrategy.sol";
import "../IVault.sol";
import "../Utils.sol";
import "../IERC20.sol";

import "./IWETH.sol";

abstract contract BaseStrategy is IStrategy {

    event Harvest(uint256 want, address rewardToken, uint256 amount);

    /// @notice vault address
    address public override vault;
    /// @notice want token id
    uint16 public override want;
    /// @notice want token address, if want == 0 then wantToken is wrapped platform token or erc20 token managed by Governance contract
    address public override wantToken;

    modifier onlyVault {
        require(msg.sender == vault, 'BaseStrategy: require Vault');
        _;
    }

    constructor(address _vault, uint16 _want, address _wantToken) {
        vault = _vault;
        want = _want;
        wantToken = _wantToken;
    }

    /// @notice receive platform token
    receive() external payable {}

    /// @notice transfer want token to vault
    function safeTransferWantTokenToVault(uint256 amount) internal {
        // we must use want token id to determine what asset vault really need
        // if ETH and WETH both in vault, ETH token id = 0, WETH token id = 1
        // the two asset have different want token id in strategy but have the same wantToken(WETH)
        if (want == 0) {
            IWETH(wantToken).withdraw(amount);
            (bool success, ) = vault.call{value: amount}("");
            require(success, "BaseStrategy: platform token transfer failed");
        } else {
            require(Utils.sendERC20(IERC20(wantToken), vault, amount), 'BaseStrategy: erc20 transfer failed');
        }
    }
}
