// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../strategy/IStrategy.sol";
import "../zksync/SafeMath.sol";
import "../zksync/IERC20.sol";
import "../zksync/Utils.sol";
import "./VaultStorage.sol";
import "./IVault.sol";

/// @title zkLink vault contract. eth or erc20 token deposited from user will transfer to vault and vault use strategy to earn more token.
/// @author zk.link
contract Vault is VaultStorage, IVault {
    using SafeMath for uint256;

    uint256 constant STRATEGY_ACTIVE_WAIT = $(defined(STRATEGY_ACTIVE_WAIT) ? STRATEGY_ACTIVE_WAIT : 604800);  // new strategy must wait one week to take effect, default is 7 days

    event StrategyAdd(uint16 tokenId, address strategy);
    event StrategyRevoke(uint16 tokenId);
    event StrategyActive(uint16 tokenId);
    event StrategyUpgradePrepare(uint16 tokenId, address strategy);
    event StrategyRevokeUpgrade(uint16 tokenId);
    event StrategyMigrate(uint16 tokenId);
    event StrategyExit(uint16 tokenId);

    modifier onlyZkLink {
        require(msg.sender == address(zkLink), 'Vault: require ZkLink');
        _;
    }

    modifier onlyNetworkGovernor {
        governance.requireGovernor(msg.sender);
        _;
    }

    receive() external payable {}

    /// @notice Vault contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    /// @dev _governanceAddress The address of Governance contract
    function initialize(bytes calldata initializationParameters) external {
        (address _governanceAddress) = abi.decode(initializationParameters, (address));
        governance = Governance(_governanceAddress);
    }

    function upgrade(bytes calldata upgradeParameters) external {}

    /// @notice Set ZkLink contract(can only be set once)
    /// @param zkLinkAddress ZkLink contract address
    function setZkLinkAddress(address payable zkLinkAddress) external {
        require(address(zkLink) == address(0), "Vault: zkLink initialized");
        zkLink = ZkLink(zkLinkAddress);
    }

    function recordDeposit(uint16 tokenId) override onlyZkLink external {
        TokenVault memory tv = tokenVaults[tokenId];
        address strategy = tv.strategy;
        // deposit token to strategy if strategy is active
        if (strategy != address(0) && tv.status == StrategyStatus.ACTIVE) {
            // deposit all balance to strategy
            uint256 balance = _tokenBalance(tokenId);
            _safeTransferToken(tokenId, strategy, balance);
            IStrategy(strategy).deposit();
        }
    }

    function commitWithdraw(uint16 tokenId, address to, uint256 amount) override onlyZkLink external {
        if (tokenWithdrawCache[tokenId] == 0) {
            tokensCache.push(tokenId);
        }
        tokenWithdrawCache[tokenId] = tokenWithdrawCache[tokenId].add(amount);
        withdrawsCache.push(CommitWithdraw(tokenId, to, amount));
    }

    function execWithdraw() override onlyZkLink external {
        // Try to withdraw the total amount that needs to be withdrawn from the strategy at once
        for(uint256 i = 0; i < tokensCache.length; i++) {
            uint16 tokenId = tokensCache[i];
            uint256 amount = tokenWithdrawCache[tokenId];
            _withdrawFromStrategy(tokenId, amount);
            delete tokenWithdrawCache[tokenId]; // clear cache
        }
        delete tokensCache; // clear cache
        // And then withdraw one by one
        for(uint256 i = 0; i < withdrawsCache.length; i++) {
            CommitWithdraw memory cw = withdrawsCache[i];
            _safeTransferToken(cw.tokenId, cw.to, cw.amount);
        }
        delete withdrawsCache; // clear cache
    }

    function withdraw(uint16 tokenId, address to, uint256 amount) override onlyZkLink external {
        _withdrawFromStrategy(tokenId, amount);
        _safeTransferToken(tokenId, to, amount);
    }

    /// @notice Return the time of strategy take effective
    function strategyActiveWaitTime() virtual public pure returns (uint256) {
        return STRATEGY_ACTIVE_WAIT;
    }

    /// @notice Add strategy to vault(can only be call by network governor)
    /// @param strategy Strategy contract address
    function addStrategy(address strategy) onlyNetworkGovernor external {
        require(strategy != address(0), 'Vault: zero strategy address');

        require(IStrategy(strategy).vault() == address(this), 'Vault: invalid strategy vault address');

        uint16 tokenId = IStrategy(strategy).want();
        _validateToken(tokenId);
        address token = governance.tokenAddresses(tokenId);
        require(token == IStrategy(strategy).wantToken(), 'Vault: invalid strategy want token');

        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy == address(0), 'Vault: strategy already exist');
        require(tv.status == StrategyStatus.NONE, 'Vault: require none');

        tv.strategy = strategy;
        tv.takeEffectTime = block.timestamp.add(strategyActiveWaitTime());
        tv.status = StrategyStatus.ADDED;

        emit StrategyAdd(tokenId, strategy);
    }

    /// @notice Revoke strategy from vault(can only be call by network governor)
    /// @param tokenId Token id
    function revokeStrategy(uint16 tokenId) onlyNetworkGovernor external {
        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.ADDED, 'Vault: require added');

        tv.strategy = address(0);
        tv.takeEffectTime = 0;
        tv.status = StrategyStatus.NONE;
        emit StrategyRevoke(tokenId);
    }

    /// @notice Active strategy of vault, strategy must wait effective time to active
    /// @param tokenId Token id
    function activeStrategy(uint16 tokenId) external {
        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.ADDED, 'Vault: require added');
        require(block.timestamp >= tv.takeEffectTime, 'Vault: time not reach');

        tv.status = StrategyStatus.ACTIVE;
        emit StrategyActive(tokenId);
    }

    /// @notice Upgrade strategy of vault(can only be call by network governor)
    /// @param strategy Strategy contract address
    function upgradeStrategy(address strategy) onlyNetworkGovernor external {
        require(strategy != address(0), 'Vault: zero strategy address');
        require(IStrategy(strategy).vault() == address(this), 'Vault: invalid strategy vault address');

        uint16 tokenId = IStrategy(strategy).want();
        _validateToken(tokenId);
        address token = governance.tokenAddresses(tokenId);
        require(token == IStrategy(strategy).wantToken(), 'Vault: invalid strategy want token');

        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.strategy != strategy, 'Vault: upgrade to self');
        require(tv.status == StrategyStatus.ACTIVE || tv.status == StrategyStatus.EXIT, 'Vault: require active or exit');
        require(tv.nextStrategy == address(0), 'Vault: next version prepared');

        tv.nextStrategy = strategy;
        tv.takeEffectTime = block.timestamp.add(strategyActiveWaitTime());
        tv.status = StrategyStatus.PREPARE_UPGRADE;

        emit StrategyUpgradePrepare(tokenId, strategy);
    }

    /// @notice Revoke upgrade strategy from vault(can only be call by network governor)
    /// @param tokenId Token id
    function revokeUpgradeStrategy(uint16 tokenId) onlyNetworkGovernor external {
        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.PREPARE_UPGRADE, 'Vault: require prepare upgrade');
        require(tv.nextStrategy != address(0), 'Vault: no next version');

        tv.nextStrategy = address(0);
        tv.takeEffectTime = 0;
        tv.status = StrategyStatus.ACTIVE;
        emit StrategyRevokeUpgrade(tokenId);
    }

    /// @notice Migrate strategy of vault after effective time
    /// @param tokenId Token id
    function migrateStrategy(uint16 tokenId) onlyNetworkGovernor external {
        TokenVault storage tv = tokenVaults[tokenId];
        address strategy = tv.strategy;
        address nextStrategy = tv.nextStrategy;
        require(strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.PREPARE_UPGRADE, 'Vault: require prepare upgrade');
        require(nextStrategy != address(0), 'Vault: no next version');
        require(block.timestamp >= tv.takeEffectTime, 'Vault: time not reach');

        IStrategy(strategy).migrate(nextStrategy);
        IStrategy(nextStrategy).onMigrate();
        tv.strategy = nextStrategy;
        tv.nextStrategy = address(0);
        tv.status = StrategyStatus.ACTIVE;
        emit StrategyMigrate(tokenId);
    }

    /// @notice Emergency exit from strategy
    /// @param tokenId Token id
    function emergencyExit(uint16 tokenId) onlyNetworkGovernor external {
        TokenVault memory tv = tokenVaults[tokenId];
        address strategy = tv.strategy;
        require(strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.ACTIVE, 'Vault: require active');

        IStrategy(strategy).emergencyExit();

        // set strategy status to exit, we can only upgrade strategy after emergency exit
        tokenVaults[tokenId].status = StrategyStatus.EXIT;

        emit StrategyExit(tokenId);
    }

    /// @notice Withdraw token from strategy if vault's token balance not enough
    /// @param tokenId Token id
    /// @param amount Amount need to withdraw from vault
    function _withdrawFromStrategy(uint16 tokenId, uint256 amount) internal {
        uint256 balance = _tokenBalance(tokenId);
        if (balance < amount) {
            // withdraw from strategy when token balance of vault can not satisfy withdraw
            TokenVault memory tv = tokenVaults[tokenId];
            address strategy = tv.strategy;
            require(strategy != address(0), 'Vault: no strategy');
            require(tv.status == StrategyStatus.ACTIVE, 'Vault: require active');

            uint256 withdrawNeeded = amount - balance;
            // strategy guarantee to withdraw successfully with no loss or revert if it can not
            IStrategy(strategy).withdraw(withdrawNeeded);
        }
    }

    /// @notice Return amount of token in this vault
    /// @param tokenId Token id
    function _tokenBalance(uint16 tokenId) internal view returns (uint256) {
        address account = address(this);
        if (tokenId == 0) {
            return account.balance;
        } else {
            address token = governance.tokenAddresses(tokenId);
            return IERC20(token).balanceOf(account);
        }
    }

    function _safeTransferToken(uint16 tokenId, address to,  uint256 amount) internal {
        if (tokenId == 0) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Vault: eth transfer failed");
        } else {
            address token = governance.tokenAddresses(tokenId);
            require(Utils.sendERC20(IERC20(token), to, amount), 'Vault: erc20 transfer failed');
        }
    }

    function _validateToken(uint16 tokenId) internal view {
        if (tokenId > 0) {
            require(governance.tokenAddresses(tokenId) != address(0), 'Vault: token not exist');
        }
    }
}
