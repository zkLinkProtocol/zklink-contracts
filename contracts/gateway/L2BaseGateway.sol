// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";

abstract contract L2BaseGateway is UUPSUpgradeable {
    /// @notice The zkLink contract
    IZkLink public zkLink;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;

    /// @dev Ensure withdraw come from zkLink
    modifier onlyZkLink() {
        require(msg.sender == address(zkLink), "Not zkLink contract");
        _;
    }

    function __L2BaseGateway_init(IZkLink _zkLink) internal onlyInitializing {
        __UUPSUpgradeable_init();
        __L2BaseGateway_init_unchained(_zkLink);
    }

    function __L2BaseGateway_init_unchained(IZkLink _zkLink) internal onlyInitializing {
        zkLink = _zkLink;
    }
}
