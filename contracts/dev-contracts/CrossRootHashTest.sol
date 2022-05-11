// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "../Storage.sol";

contract CrossRootHashTest is Storage {

    constructor(Governance gov) {
        governance = gov;
    }

    function setTotalBlocksExecuted(uint32 v) external {
        totalBlocksExecuted = v;
    }

    function setTotalBlocksProven(uint32 v) external {
        totalBlocksProven = v;
    }

    function setBlockHash(uint32 n, bytes32 h) external {
        storedBlockHashes[n] = h;
    }
}
