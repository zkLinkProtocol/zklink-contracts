// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

abstract contract BaseGateway is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    /// @notice Gateway address on remote chain
    address public remoteGateway;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;

    event SetRemoteGateway(address remoteGateWay);

    function __BaseGateway_init() internal onlyInitializing {
        __BaseGateway_init_unchained();
    }

    function __BaseGateway_init_unchained() internal onlyInitializing {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external onlyOwner {
        remoteGateway = _remoteGateway;
        emit SetRemoteGateway(_remoteGateway);
    }

    /// @dev Pause the contract, can only be called by the owner
    function pause() external onlyOwner {
        _pause();
    }

    /// @dev Unpause the contract, can only be called by the owner
    function unpause() external onlyOwner {
        _unpause();
    }
}
