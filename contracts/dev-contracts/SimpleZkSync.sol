// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "../ZkSync.sol";
import "../Utils.sol";
import "../SafeCast.sol";

contract SimpleZkSync {

    Governance public governance;
    IVault public vault;

    constructor(address _governance, address payable _vault) {
        governance = Governance(_governance);
        vault = IVault(_vault);
    }

    function depositETH(address /*_zkSyncAddress*/) external payable {
        vault.recordDeposit(0, msg.value);
        payable(address(vault)).transfer(msg.value);
    }

    function depositERC20(
        IERC20 _token,
        uint104 _amount,
        address /*_zkSyncAddress*/
    ) external {
        uint16 tokenId = governance.validateTokenAddress(address(_token));
        require(Utils.transferFromERC20(_token, msg.sender, address(vault), SafeCast.toUint128(_amount)), "fd012"); // token transfer failed deposit
        vault.recordDeposit(tokenId, _amount);
    }

    function depositETHFromVault(address /*_zkSyncAddress*/, uint256 _amount) external {
        require(msg.sender == address(vault), 'dev0');
        vault.recordDeposit(0, _amount);
    }

    function depositERC20FromVault(uint16 _tokenId, address /*_zkSyncAddress*/, uint256 _amount) external {
        require(msg.sender == address(vault), 'dev1');
        vault.recordDeposit(_tokenId, _amount);
    }

    function withdrawPendingBalance(
        address payable _owner,
        address _token,
        uint128 _amount,
        uint16 _lossBip
    ) external {
        if (_token == address(0)) {
            vault.withdraw(0, _owner, _amount, _amount, _lossBip);
        } else {
            uint16 tokenId = governance.validateTokenAddress(_token);
            vault.withdraw(tokenId, _owner, _amount, _amount, _lossBip);
        }
    }
}
