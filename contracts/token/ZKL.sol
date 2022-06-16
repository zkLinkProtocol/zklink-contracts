// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./IZKL.sol";

/// @title ZkLink token contract
/// ZKL is a token with native cross-chain capability. User can select different bridges such as LayerZero, MultiChain.
/// @author zk.link
contract ZKL is ERC20Capped, ERC20Permit, IZKL {

    // the CHAIN_ID is defined in ZkLink, default is Ethereum Mainnet or Polygon Mumbai Testnet
    bool public constant IS_MINT_CHAIN = $$(CHAIN_ID == 1);
    uint256 public constant CAP = 1000000000 * 1e18;

    /// @notice ZkLink contract
    IGovernance public governance;

    constructor(IGovernance _governance) ERC20("ZKLINK", "ZKL") ERC20Capped(CAP) ERC20Permit("ZKLINK") {
        governance = _governance;
    }

    modifier onlyGovernor {
        require(msg.sender == governance.networkGovernor(), "Caller is not governor");
        _;
    }

    /// @notice Mint ZKL
    function mintTo(address to, uint256 amount) external onlyGovernor {
        require(IS_MINT_CHAIN, "Not mint chain");

        _mint(to, amount);
    }

    /// @dev only bridge can call this function
    function bridgeTo(address spender, address from, uint256 amount) external override {
        require(governance.isBridgeToEnabled(msg.sender), "Bridge to disabled");

        // burn token of `from`
        if (spender != from) {
            _spendAllowance(from, spender, amount);
        }
        _burn(from, amount);
    }

    /// @dev only bridge can call this function
    function bridgeFrom(address receiver, uint256 amount) external override {
        require(governance.isBridgeFromEnabled(msg.sender), "Bridge from disabled");

        // mint token to receiver
        _mint(receiver, amount);
    }

    /**
     * @dev See {ERC20-_mint}.
     */
    function _mint(address account, uint256 amount) internal override(ERC20Capped, ERC20) {
        ERC20Capped._mint(account, amount);
    }
}

interface IGovernance {
    /// @notice Return the network governor address
    function networkGovernor() external view returns (address);

    /// @notice Check if bridge to enabled
    /// @param bridge the bridge contract
    function isBridgeToEnabled(address bridge) external view returns (bool);

    /// @notice Check if bridge from enabled
    /// @param bridge the bridge contract
    function isBridgeFromEnabled(address bridge) external view returns (bool);
}
