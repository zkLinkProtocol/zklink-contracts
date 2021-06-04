// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../PairTokenManager.sol";

contract PairTokenManagerTest is PairTokenManager {

    function testAddPairToken(address _token) external {
        addPairToken(_token);
    }
}
