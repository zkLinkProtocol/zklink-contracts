// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "@chainlink/contracts/src/v0.7/ChainlinkClient.sol";

/// @title Chainlink oracle consumer
/// @author ZkLink Labs
contract ChainlinkCrtReporter is ChainlinkClient {
    using Chainlink for Chainlink.Request;

    bytes32 public jobId;
    uint256 public fee;

    mapping(uint32 => bool) public crtVerified;

    constructor(address _oracle, bytes32 _jobId, uint256 _fee) {
        setPublicChainlinkToken();
        setChainlinkOracle(_oracle);
        jobId = _jobId;
        fee = _fee;
    }

    function verifyCrt(uint32 _crtBlock) external {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillCrt.selector);
        req.addUint("block", _crtBlock);
        sendChainlinkRequest(req, fee);
    }

    function isCrtVerified(uint32 _crtBlock) external view returns (bool) {
        return crtVerified[_crtBlock];
    }

    function fulfillCrt(bytes32 _requestId, uint32 _crtBlock) external recordChainlinkFulfillment(_requestId) {
        crtVerified[_crtBlock] = true;
    }
}
