// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkLink.sol";
import "../zksync/Utils.sol";
import "../zksync/SafeCast.sol";

contract SimpleZkLink {

    Governance public governance;

    constructor(address _governance) {
        governance = Governance(_governance);
    }

    function depositETH(address /*_zkLinkAddress*/) external payable {
//        payable(address(vault)).transfer(msg.value);
    }

    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        address /*_zkLinkAddress*/
    ) external {
//        uint16 tokenId = governance.validateTokenAddress(address(_token));
//        require(Utils.transferFromERC20(_token, msg.sender, address(vault), SafeCast.toUint128(_amount)), "fd012"); // token transfer failed deposit
    }
}
