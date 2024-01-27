// contracts/Messages.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

interface IWormhole {
    struct GuardianSet {
        address[] keys;
        uint32 expirationTime;
    }

    function getGuardianSet(uint32 index) external view returns (GuardianSet memory);

    function getCurrentGuardianSetIndex() external view returns (uint32);

}