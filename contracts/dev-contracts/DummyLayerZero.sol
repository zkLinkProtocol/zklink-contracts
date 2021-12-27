// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/ILayerZeroReceiver.sol";
import "../token/ILayerZeroEndpoint.sol";

contract DummyLayerZero is ILayerZeroEndpoint {

    ILayerZeroReceiver public zkl;

    function setZKL(ILayerZeroReceiver _zkl) external {
        zkl = _zkl;
    }

    function send(uint16 /**_chainId**/,
        bytes calldata /**_destination**/,
        bytes calldata /**_payload**/,
        address payable /**_refundAddress**/,
        address /**_zroPaymentAddress**/,
        bytes calldata /**_txParameters**/) override external payable {
        require(msg.value > 0, 'LZ: require fee');
    }

    function lzReceive(uint16 _srcChainId, address _srcAddress, uint64 _nonce, bytes calldata _to, uint _amount) external {
        bytes memory payload = abi.encode(_to, _amount);
        zkl.lzReceive(_srcChainId, abi.encodePacked(_srcAddress), _nonce, payload);
    }
}
