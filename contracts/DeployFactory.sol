// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./zksync/Proxy.sol";
import "./zksync/UpgradeGatekeeper.sol";
import "./Governance.sol";
import "./ZkLink.sol";

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
    constructor(
        Governance _govTarget,
        ZkLink _zkLinkTarget,
        address _verifier,
        address _periphery,
        bytes32 _genesisRoot,
        address _firstValidator,
        address _governor,
        address _feeAccountAddress
    ) {
        require(_firstValidator != address(0), "D0");
        require(_governor != address(0), "D1");
        require(_feeAccountAddress != address(0), "D2");

        // set this contract as governor
        Proxy governance = new Proxy(address(_govTarget), abi.encode(this));
        deployProxyContracts(governance, _zkLinkTarget, _verifier, _periphery, _genesisRoot, _firstValidator, _governor);

        selfdestruct(msg.sender);
    }

    event Addresses(address governance, address zkLink, address gatekeeper);

    function deployProxyContracts(
        Proxy governance,
        ZkLink _zkLinkTarget,
        address _verifier,
        address _periphery,
        bytes32 _genesisRoot,
        address _validator,
        address _governor
    ) internal {
        Proxy zkLink =
            new Proxy(address(_zkLinkTarget), abi.encode(address(governance), _verifier, _periphery, _genesisRoot));

        UpgradeGatekeeper upgradeGatekeeper = new UpgradeGatekeeper(zkLink);

        governance.transferMastership(address(upgradeGatekeeper));
        upgradeGatekeeper.addUpgradeable(address(governance));

        zkLink.transferMastership(address(upgradeGatekeeper));
        upgradeGatekeeper.addUpgradeable(address(zkLink));

        upgradeGatekeeper.transferMastership(_governor);

        emit Addresses(address(governance), address(zkLink), address(upgradeGatekeeper));

        finalizeGovernance(Governance(address(governance)), _validator, _governor);
    }

    function finalizeGovernance(
        Governance _governance,
        address _validator,
        address _finalGovernor
    ) internal {
        _governance.setValidator(_validator, true);
        _governance.changeGovernor(_finalGovernor);
    }
}
