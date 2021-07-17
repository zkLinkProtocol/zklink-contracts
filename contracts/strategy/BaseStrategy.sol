// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../IStrategy.sol";
import "../IVault.sol";
import "../Utils.sol";
import "../IERC20.sol";

import "./IWETH.sol";

abstract contract BaseStrategy is IStrategy {

    event Harvest(uint256 want, address rewardToken, uint256 amount);

    /// @notice Vault is a proxy address and will be not changed after upgrade
    address public constant VAULT_ADDRESS = $(VAULT_ADDRESS);

    /// @notice want token id
    uint16 public override want;
    /// @notice want token address, if want == 0 then wantToken is wrapped platform token or erc20 token managed by Governance contract
    address public wantToken;

    modifier onlyVault {
        require(msg.sender == vault(), 'BaseStrategy: require Vault');
        _;
    }

    constructor(uint16 _want) {
        initWant(_want);
    }

    function initWant(uint16 _want) virtual internal {
        want = _want;
        if (want == 0) {
            wantToken = weth();
        } else {
            wantToken = IVault(vault()).wantToken(_want);
        }
    }

    /// @notice receive platform token
    receive() external payable {}

    function vault() public virtual override view returns (address) {
        return VAULT_ADDRESS;
    }

    /// @notice Return wrapped platform token address:WETH, WBNB, WHT
    function weth() public virtual view returns (address);

    /// @notice transfer want token to vault
    function safeTransferWantTokenToVault(uint256 amount) internal {
        // do not use wantToken == weth() condition, we must use want token id to determine what asset vault really need
        // if ETH and WETH both in vault, ETH token id = 0, WETH token id = 1
        // the two asset have different want token id in strategy but have the same wantToken(WETH)
        if (want == 0) {
            IWETH(wantToken).withdraw(amount);
            (bool success, ) = vault().call{value: amount}("");
            require(success, "BaseStrategy: eth transfer failed");
        } else {
            require(Utils.sendERC20(IERC20(wantToken), vault(), amount), 'BaseStrategy: erc20 transfer failed');
        }
    }
}
