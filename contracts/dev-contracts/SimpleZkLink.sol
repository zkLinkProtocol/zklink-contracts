// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkLink.sol";
import "../zksync/Utils.sol";
import "../zksync/SafeCast.sol";

contract SimpleZkLink {

    Governance public governance;
    IVault public vault;

    constructor(address _governance, address payable _vault) {
        governance = Governance(_governance);
        vault = IVault(_vault);
    }

    function depositETH(address /*_zkLinkAddress*/) external payable {
        payable(address(vault)).transfer(msg.value);
        vault.recordDeposit(0);
    }

    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        address /*_zkLinkAddress*/
    ) external {
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), SafeCast.toUint128(_amount)), "fd012"); // token transfer failed deposit
        vault.recordDeposit(tokenId);
    }

    function withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount
    ) external {
        if (_token == address(0)) {
            vault.withdraw(0, _owner, _amount);
        } else {
            uint16 tokenId = governance.validateTokenAddress(_token);
            vault.withdraw(tokenId, _owner, _amount);
        }
    }
}
