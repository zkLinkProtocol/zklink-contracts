// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./IPyth.sol";

/// @title Verify oracle committed data for pyth
/// @author zk.link
contract PythVerifier {

    /// @notice The pyth contract
    IPyth public immutable pyth;

    constructor(IPyth _pyth) {
        pyth = _pyth;
    }

    function verify(uint32 guardianSetIndex, bytes32 guardianSetAddressHash, uint256 totalNumUpdates) external {
        // verify guardian set
        IWormhole wormhole = pyth.wormhole();
        IWormhole.GuardianSet memory guardianSet = wormhole.getGuardianSet(guardianSetIndex);
        require(guardianSet.keys.length > 0, "Invalid guardian set index");
        require(guardianSetIndex == wormhole.getCurrentGuardianSetIndex() || guardianSet.expirationTime >= block.timestamp, "Guardian set has expired");

        // check the address set used to verify signature offchain is valid
        bytes memory addressHashContent;
        for (uint256 i = 0; i < guardianSet.keys.length; ++i) {
            addressHashContent = abi.encodePacked(addressHashContent, guardianSet.keys[i]);
        }
        require(keccak256(addressHashContent) == guardianSetAddressHash, "Invalid guardian set address hash");

        // calculate fee that need to pay for pyth
        uint256 requiredFee = pyth.singleUpdateFeeInWei() * totalNumUpdates;
        pyth.updatePriceFeeds{value: requiredFee}(new bytes[](0));
    }
}
