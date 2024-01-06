// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ZkLinkAcceptor} from "../ZkLinkAcceptor.sol";
import {IArbitrator} from "../interfaces/IArbitrator.sol";

abstract contract L1BaseGateway is ZkLinkAcceptor, OwnableUpgradeable {
    /// @notice The arbitrator to confirm block
    IArbitrator public arbitrator;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;

    /// @dev Modifier to make sure the caller is the known arbitrator.
    modifier onlyArbitrator() {
        require(msg.sender == address(arbitrator), "Not arbitrator");
        _;
    }

    event SetArbitrator(address arbitrator);

    /// @notice Set arbitrator
    function setArbitrator(IArbitrator _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
        emit SetArbitrator(address(_arbitrator));
    }
}
