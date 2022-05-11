// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IZKL.sol";
import "../bridge/IBridgeManager.sol";

/// @title ZkLink token contract
/// ZKL is a token with native cross-chain capability. User can select different bridges such as LayerZero, MultiChain.
/// @author zk.link
contract ZKL is ERC20Capped, ERC20Permit, Ownable, IZKL {

    // the CHAIN_ID is defined in ZkLink, default is Ethereum Mainnet or Polygon Mumbai Testnet
    bool public constant IS_MINT_CHAIN = $$(CHAIN_ID == 1);
    uint256 public constant CAP = 1000000000 * 1e18;

    event BridgeTo(address indexed bridge, address sender, uint16 chainId, bytes receiver, uint amount, uint64 nonce);
    event BridgeFrom(address indexed bridge, uint16 chainId, address receiver, uint amount, uint64 nonce);

    IBridgeManager public bridgeManager;

    constructor(IBridgeManager _bridgeManager) ERC20("ZKLINK", "ZKL") ERC20Capped(CAP) ERC20Permit("ZKLINK") {
        bridgeManager = _bridgeManager;
    }

    /// @notice Mint ZKL
    function mintTo(address to, uint256 amount) external onlyOwner {
        require(IS_MINT_CHAIN, "Not mint chain");

        _mint(to, amount);
    }

    /// @dev only bridge can call this function
    function bridgeTo(address spender, address from, uint16 dstChainId, bytes memory to, uint256 amount, uint64 nonce) external override {
        address bridge = msg.sender;
        require(bridgeManager.isBridgeToEnabled(bridge), "Bridge to disabled");

        // burn token of `from`
        if (spender != from) {
            _spendAllowance(from, spender, amount);
        }
        _burn(from, amount);
        emit BridgeTo(bridge, from, dstChainId, to, amount, nonce);
    }

    /// @dev only bridge can call this function
    function bridgeFrom(uint16 srcChainId, address receiver, uint256 amount, uint64 nonce) external override {
        address bridge = msg.sender;
        require(bridgeManager.isBridgeFromEnabled(bridge), "Bridge from disabled");

        // mint token to receiver
        _mint(receiver, amount);
        emit BridgeFrom(bridge, srcChainId, receiver, amount, nonce);
    }

    /**
     * @dev See {ERC20-_mint}.
     */
    function _mint(address account, uint256 amount) internal override(ERC20Capped, ERC20) {
        ERC20Capped._mint(account, amount);
    }
}
