// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./zksync/Proxy.sol";
import "./zksync/UpgradeGatekeeper.sol";
import "./ZkLink.sol";
import "./ZkLinkPeriphery.sol";
import "./interfaces/IVerifier.sol";

/// @title Deploy ZkLink
/// @author zk.link
contract DeployFactory {
    // Why do we deploy contracts in the constructor?
    //
    // If we want to deploy Proxy and UpgradeGatekeeper (using new) we have to deploy their contract code with this contract
    // in total deployment of this contract would cost us around 2.5kk of gas and calling final transaction
    // deployProxyContracts would cost around 3.5kk of gas(which is equivalent but slightly cheaper then doing deploy old way by sending
    // transactions one by one) but doing this in one method gives us simplicity and atomicity of our deployment.
    //
    // If we use selfdesctruction in the constructor then it removes overhead of deploying Proxy and UpgradeGatekeeper
    // with DeployFactory and in total this constructor would cost us around 3.5kk, so we got simplicity and atomicity of
    // deploy without overhead.
    //
    // `_feeAccountAddress` argument is not used by the constructor itself, but it's important to have this
    // information as a part of a transaction, since this transaction can be used for restoring the tree
    // state. By including this address to the list of arguments, we're making ourselves able to restore
    // genesis state, as the very first account in tree is a fee account, and we need its address before
    // we're able to start recovering the data from the Ethereum blockchain.
    constructor(IVerifier _verifierTarget, ZkLink _zkLinkTarget, ZkLinkPeriphery _peripheryTarget, uint32 _blockNumber, uint256 _timestamp, bytes32 _stateHash, bytes32 _commitment, bytes32 _syncHash, address _firstValidator, address _governor, address _feeAccountAddress) {
        require(_firstValidator != address(0), "D0");
        require(_governor != address(0), "D1");
        require(_feeAccountAddress != address(0), "D2");

        Proxy verifier = new Proxy(address(_verifierTarget), abi.encode());
        deployProxyContracts(verifier, _zkLinkTarget, _peripheryTarget,
            _blockNumber, _timestamp, _stateHash, _commitment, _syncHash,
            _firstValidator, _governor);

        selfdestruct(msg.sender);
    }

    event Addresses(Proxy verifier, Proxy zkLink, UpgradeGatekeeper gatekeeper);

    function deployProxyContracts(Proxy verifier, ZkLink _zkLinkTarget, ZkLinkPeriphery _peripheryTarget, uint32 _blockNumber, uint256 _timestamp, bytes32 _stateHash, bytes32 _commitment, bytes32 _syncHash, address _validator, address _governor) internal {
        // set this contract as governor
        Proxy zkLink =
            new Proxy(address(_zkLinkTarget), abi.encode(address(verifier), address(_peripheryTarget), address(this),
                _blockNumber, _timestamp, _stateHash, _commitment, _syncHash));

        UpgradeGatekeeper upgradeGatekeeper = new UpgradeGatekeeper(address(zkLink));

        emit Addresses(verifier, zkLink, upgradeGatekeeper);

        verifier.transferMastership(address(upgradeGatekeeper));
        upgradeGatekeeper.addUpgradeable(address(verifier));

        zkLink.transferMastership(address(upgradeGatekeeper));
        upgradeGatekeeper.addUpgradeable(address(zkLink));

        upgradeGatekeeper.transferMastership(_governor);

        ZkLinkPeriphery peripheryProxy = ZkLinkPeriphery(address(zkLink));
        peripheryProxy.setValidator(_validator, true);
        peripheryProxy.changeGovernor(_governor);
    }
}
