// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity 0.8.9;

import "@api3/airnode-protocol/contracts/rrp/requesters/RrpRequester.sol";

/// @title Abi3 oracle consumer
/// @author zk.link
contract Abi3CrtReporter is RrpRequester {
    mapping(bytes32 => bool) public incomingFulfillments;
    mapping(uint32 => bool) public crtVerified;

    address public airnode;
    bytes32 public endpointId;
    address public sponsor;
    address public sponsorWallet;

    constructor(address _airnodeRrp,
        address _airnode,
        bytes32 _endpointId,
        address _sponsor,
        address _sponsorWallet) RrpRequester(_airnodeRrp) {
        airnode = _airnode;
        endpointId = _endpointId;
        sponsor = _sponsor;
        sponsorWallet = _sponsorWallet;
    }

    function verifyCrt(uint32 _crtBlock) external {
        bytes memory parameters = abi.encode(
            bytes32("1u"),
            bytes32("block"), uint256(_crtBlock)
        );
        bytes32 requestId = airnodeRrp.makeFullRequest(
            airnode,
            endpointId,
            sponsor,
            sponsorWallet,
            address(this),
            this.fulfillCrt.selector,
            parameters
        );
        incomingFulfillments[requestId] = true;
    }

    function isCrtVerified(uint32 _crtBlock) external view returns (bool) {
        return crtVerified[_crtBlock];
    }

    function fulfillCrt(bytes32 _requestId, bytes calldata _data) external onlyAirnodeRrp {
        require(incomingFulfillments[_requestId], "Abi3CrtReporter: No such request made");
        delete incomingFulfillments[_requestId];
        uint32 _crtBlock = uint32(abi.decode(_data, (uint256)));
        crtVerified[_crtBlock] = true;
    }
}
