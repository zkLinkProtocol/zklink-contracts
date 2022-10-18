//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./AccountMock.sol";

contract AccountMockDeployer {

    AccountMock public am;

    function deployAccountMock(bytes32 salt, address owner) external {
        am = new AccountMock{salt: salt}(owner);
    }
}