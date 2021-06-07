// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./IStrategy.sol";
import "./SafeMath.sol";
import "./IERC20.sol";
import "./ZkSync.sol";
import "./Utils.sol";
import "./VaultStorage.sol";

/// @title zkLink vault contract. eth or erc20 token deposited from user will transfer to vault and vault use strategy to earn more token.
/// @author ZkLink Labs
contract Vault is VaultStorage {
    using SafeMath for uint256;

    uint16 constant MAX_BPS = 10000;  // 100%, or 10k basis points
    uint256 constant STRATEGY_ACTIVE_WAIT = 7 days;  // new strategy must wait one week to take effect

    event ReserveRatioUpdate(uint16 tokenId, uint16 ratio);
    event RewardConfigUpdate(address userRewardAddress, address protocolRewardAddress, uint16 protocolRewardRatio);
    event StrategyAdd(uint16 tokenId, address strategy);
    event StrategyRevoke(uint16 tokenId);
    event StrategyActive(uint16 tokenId);
    event StrategyUpgradePrepare(uint16 tokenId, address strategy);
    event StrategyRevokeUpgrade(uint16 tokenId);
    event StrategyMigrate(uint16 tokenId);
    event TransferToStrategy(uint16 tokenId, address strategy, uint256 amount);
    event SettleReward(uint16 tokenId, address userRewardAddress, address protocolRewardAddress, uint256 userAmount, uint256 protocolAmount);

    modifier onlyZkSync {
        require(msg.sender == address(zkSync), 'Vault: require ZkSync');
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

    /// @notice Set zkSync contract(can only be set once)
    /// @param zkSyncAddress ZkSync contract address
    function setZkSyncAddress(address payable zkSyncAddress) external {
        require(address(zkSync) == address(0), "Vault: zkSync initialized");
        zkSync = ZkSync(zkSyncAddress);
    }

    /// @notice Set token reserve ratio
    /// @param tokenId Token id
    /// @param reserveRatio Reserve ratio
    function setTokenReserveRatio(uint16 tokenId, uint16 reserveRatio) onlyNetworkGovernor external {
        _validateToken(tokenId);
        require(reserveRatio <= MAX_BPS, 'Vault: over max bps');

        tokenVaults[tokenId].reserveRatio = reserveRatio;
        emit ReserveRatioUpdate(tokenId, reserveRatio);
    }

    /// @notice Set reward config(can only be set by network governor)
    /// @param _userRewardAddress User reward address
    /// @param _protocolRewardAddress Protocol reward address
    /// @param _protocolRewardRatio Protocol reward ratio
    function setReward(address _userRewardAddress, address _protocolRewardAddress, uint16 _protocolRewardRatio) onlyNetworkGovernor external {
        require(_protocolRewardRatio <= MAX_BPS, 'Vault: over max bps');
        userRewardAddress = _userRewardAddress;
        protocolRewardAddress = _protocolRewardAddress;
        protocolRewardRatio = _protocolRewardRatio;
        emit RewardConfigUpdate(_userRewardAddress, _protocolRewardAddress, _protocolRewardRatio);
    }

    /// @notice Return the total amount of token in this vault and strategy if exist
    /// @param tokenId Token id
    function totalAsset(uint16 tokenId) public view returns (uint256) {
        address strategy = tokenVaults[tokenId].strategy;
        if (strategy != address(0)) {
            return _tokenBalance(tokenId).add(IStrategy(strategy).totalAsset());
        } else {
            return _tokenBalance(tokenId);
        }
    }

    /// @notice Return amount of debt owned by this vault
    /// @param tokenId Token id
    function totalDebt(uint16 tokenId) external view returns (uint256) {
        return tokenVaults[tokenId].debt;
    }

    /// @notice Record user deposit(can only be call by zkSync), after deposit debt of vault will increase
    /// @param tokenId Token id
    /// @param amount Token amount
    function recordDeposit(uint16 tokenId, uint256 amount) onlyZkSync external {
        tokenVaults[tokenId].debt = tokenVaults[tokenId].debt.add(amount);
    }

    /// @notice Withdraw token from vault to satisfy user withdraw request(can only be call by zkSync)
    /// @notice Withdraw may produce loss, after withdraw debt of vault will decrease
    /// @param tokenId Token id
    /// @param to Token receive address
    /// @param amount Amount of tokens to transfer
    /// @param maxAmount Maximum possible amount of tokens to transfer
    /// @param lossBip Loss bip which user can accept, 100 means 1% loss
    /// @return uint256 Amount debt of vault decreased
    function withdraw(uint16 tokenId, address to, uint256 amount, uint256 maxAmount, uint256 lossBip) onlyZkSync external returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        // NOTE: token may take fees when transfer
        // NOTE: withdraw from strategy may produce loss, loss comes from two aspects
        // 1. strategy sell large amount of token may produce huge slippage
        // 2. strategy transfer token to vault may be taken fees by token
        uint256 loss;
        uint256 balanceBefore = _tokenBalance(tokenId);
        if (balanceBefore < amount) {
            // withdraw from strategy when token balance of vault can not satisfy withdraw
            address strategy = tokenVaults[tokenId].strategy;
            require(strategy != address(0), 'Vault: no strategy');
            uint256 withdrawNeeded = amount - balanceBefore;
            loss = IStrategy(strategy).withdraw(withdrawNeeded);
            uint256 balanceAfterStrategyWithdraw = _tokenBalance(tokenId);
            // after withdraw from strategy, vault token amount added + loss must equal withdrawNeeded
            require(withdrawNeeded == balanceAfterStrategyWithdraw.sub(balanceBefore).add(loss), 'Vault: strategy withdraw invalid state');
            balanceBefore = balanceAfterStrategyWithdraw;
        }

        uint256 amountWithdraw = amount > balanceBefore ? balanceBefore : amount;
        _safeTransferToken(tokenId, to, amountWithdraw);
        uint256 balanceAfter = _tokenBalance(tokenId);
        // debt decrease = balance decreased of vault + loss when withdraw from strategy
        uint256 debtDecrease = balanceBefore.sub(balanceAfter).add(loss);
        require(debtDecrease <= maxAmount, 'Vault: over maxAmount');
        require(loss.mul(MAX_BPS).div(debtDecrease) <= lossBip, 'Vault: over loss');

        // debt of vault decrease
        tokenVaults[tokenId].debt = tokenVaults[tokenId].debt.sub(debtDecrease);
        return debtDecrease;
    }

    /// @notice Return the time of strategy take effective
    function strategyActiveWaitTime() public pure returns (uint256) {
        return STRATEGY_ACTIVE_WAIT;
    }

    /// @notice Add strategy to vault(can only be call by network governor)
    /// @param strategy Strategy contract address
    function addStrategy(address strategy) onlyNetworkGovernor external {
        require(strategy != address(0), 'Vault: zero strategy address');

        uint16 tokenId = IStrategy(strategy).want();
        _validateToken(tokenId);

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

        uint16 tokenId = IStrategy(strategy).want();
        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.strategy != strategy, 'Vault: upgrade to self');
        require(tv.status == StrategyStatus.ACTIVE, 'Vault: require active');
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
    function migrateStrategy(uint16 tokenId) external {
        TokenVault storage tv = tokenVaults[tokenId];
        require(tv.strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.PREPARE_UPGRADE, 'Vault: require prepare upgrade');
        require(tv.nextStrategy != address(0), 'Vault: no next version');
        require(block.timestamp >= tv.takeEffectTime, 'Vault: time not reach');

        IStrategy(tv.strategy).migrate(tv.nextStrategy);
        tv.strategy = tv.nextStrategy;
        tv.nextStrategy = address(0);
        tv.status = StrategyStatus.ACTIVE;
        emit StrategyMigrate(tokenId);
    }

    /// @notice Return the amount of token that can transfer to strategy if strategy is active
    /// @param tokenId Token id
    function getStrategyAvailableTransferAmount(uint16 tokenId) external view returns (uint256) {
        TokenVault memory tv = tokenVaults[tokenId];
        if (tv.strategy == address(0) || tv.status != StrategyStatus.ACTIVE) {
            return 0;
        }
        uint256 balance = _tokenBalance(tokenId);
        uint256 balanceReserve = tv.debt.mul(tv.reserveRatio).div(MAX_BPS);
        if (balanceReserve >= balance) {
            return 0;
        }
        return balance - balanceReserve;
    }

    /// @notice Transfer token to strategy for earning(can only be call by network governor)
    /// @param tokenId Token id
    /// @param amount Token amount transfer to strategy
    /// @return uint256 Token amount that really transferred to strategy
    function transferToStrategy(uint16 tokenId, uint256 amount) onlyNetworkGovernor external returns (uint256) {
        require(amount > 0, 'Vault: amount is zero');

        TokenVault memory tv = tokenVaults[tokenId];
        address strategy = tv.strategy;
        require(strategy != address(0), 'Vault: no strategy');
        require(tv.status == StrategyStatus.ACTIVE, 'Vault: require active');

        uint256 balance = _tokenBalance(tokenId);
        uint256 balanceReserve = tv.debt.mul(tv.reserveRatio).div(MAX_BPS);
        if (balanceReserve >= balance) {
            return 0;
        }
        uint256 maxTransfer = balance - balanceReserve;
        amount = amount > maxTransfer ? maxTransfer : amount;

        _safeTransferToken(tokenId, strategy, amount);
        emit TransferToStrategy(tokenId, strategy, amount);
        return amount;
    }

    /// @notice Settle profit to user reward address and protocol reward address(can only be call by network governor)
    /// @param tokenId Token id
    function settleReward(uint16 tokenId) onlyNetworkGovernor external {
        require(userRewardAddress != address(0), 'Vault: no user reward address');
        require(protocolRewardAddress != address(0), 'Vault: no protocol reward address');

        uint256 asset = totalAsset(tokenId);
        TokenVault memory tv = tokenVaults[tokenId];
        uint debt = tv.debt;
        if (debt >= asset) {
            return;
        }
        uint profit = asset - debt;

        uint protocolReward = profit.mul(protocolRewardRatio).div(MAX_BPS);
        uint userReward = profit - protocolReward;

        // just record the increase token amount of reward address, not really transfer token to them
        if (tokenId == 0) {
            zkSync.depositETHFromVault(userRewardAddress, userReward);
            zkSync.depositETHFromVault(protocolRewardAddress, protocolReward);
        } else {
            zkSync.depositERC20FromVault(tokenId, userRewardAddress, userReward);
            zkSync.depositERC20FromVault(tokenId, protocolRewardAddress, protocolReward);
        }
        require(tokenVaults[tokenId].debt == asset, 'Vault: debt asset not match');
        emit SettleReward(tokenId, userRewardAddress, protocolRewardAddress, userReward, protocolReward);
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
