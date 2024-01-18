// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./IPyth.sol";
import {IOracleVerifier} from "../interfaces/IOracleVerifier.sol";

/// @title Verify oracle committed data for pyth
/// @author zk.link
contract PythVerifier is IOracleVerifier {
    /// @notice The pyth contract
    IPyth public immutable pyth;

    constructor(IPyth _pyth) {
        pyth = _pyth;
    }

    function estimateVerifyFee(bytes memory oracleContent) external view returns (uint256 nativeFee) {
        (uint256 usedPythNum, , ,) = abi.decode(oracleContent, (uint256, uint256, bytes32, uint256));
        nativeFee = pyth.singleUpdateFeeInWei() * usedPythNum;
    }

    function verify(bytes memory oracleContent) external payable returns (bytes32 oracleCommitment) {
        (uint256 usedPythNum, uint256 guardianSetIndex, bytes32 guardianSetHash, uint256 earliestPublishTime) = abi.decode(oracleContent, (uint256, uint256, bytes32, uint256));
        oracleCommitment = keccak256(abi.encodePacked(usedPythNum, guardianSetIndex, guardianSetHash, earliestPublishTime));
        if (usedPythNum == 0) {
            return oracleCommitment;
        }
        // verify guardian set
        IWormhole wormhole = pyth.wormhole();
        IWormhole.GuardianSet memory guardianSet = wormhole.getGuardianSet(uint32(guardianSetIndex));
        require(guardianSet.keys.length > 0, "Invalid guardian set index");
        require(guardianSetIndex == wormhole.getCurrentGuardianSetIndex() || guardianSet.expirationTime >= block.timestamp, "Guardian set has expired");

        // check the address set used to verify signature offchain is valid
        bytes memory addressHashContent;
        for (uint256 i = 0; i < guardianSet.keys.length; ++i) {
            addressHashContent = abi.encodePacked(addressHashContent, guardianSet.keys[i]);
        }
        require(keccak256(addressHashContent) == guardianSetHash, "Invalid guardian set address hash");

        // calculate fee that need to pay for pyth
        uint256 requiredFee = pyth.singleUpdateFeeInWei() * usedPythNum;
        require(msg.value == requiredFee, "Invalid fee");
        pyth.updatePriceFeeds{value: requiredFee}(new bytes[](0));
    }
}
