// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILayerZeroReceiver.sol";
import "./ILayerZeroEndpoint.sol";
import "./ILayerZeroUserApplicationConfig.sol";
import "./LayerZeroStorage.sol";
import "../zksync/ReentrancyGuard.sol";
import "../interfaces/ISyncService.sol";

/// @title LayerZero bridge implementation of non-blocking model
/// @dev if message is blocking we should call `retryPayload` of endpoint to retry
/// the reasons for message blocking may be:
/// * `_dstAddress` is not deployed to dst chain, and we can deploy LayerZeroBridge to dst chain to fix it.
/// * lzReceive cost more gas than `_gasLimit` that endpoint send, and user should call `retryMessage` to fix it.
/// * lzReceive reverted unexpected, and we can fix bug and deploy a new contract to fix it.
/// @author zk.link
contract LayerZeroBridge is ReentrancyGuard, LayerZeroStorage, ISyncService, ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
    modifier onlyEndpoint {
        require(msg.sender == address(endpoint), "Require endpoint");
        _;
    }

    modifier onlyGovernor {
        require(msg.sender == zklink.networkGovernor(), "Caller is not governor");
        _;
    }

    modifier onlyZkLink {
        require(msg.sender == address(zklink), "Caller is not zkLink");
        _;
    }

    /// @param _zklink The zklink contract address
    /// @param _endpoint The LayerZero endpoint
    constructor(IZkLink _zklink, ILayerZeroEndpoint _endpoint) {
        initializeReentrancyGuard();

        zklink = _zklink;
        endpoint = _endpoint;
    }

    //---------------------------UserApplication config----------------------------------------
    function setConfig(uint16 _version, uint16 _chainId, uint _configType, bytes calldata _config) external override onlyGovernor {
        endpoint.setConfig(_version, _chainId, _configType, _config);
    }

    function setSendVersion(uint16 _version) external override onlyGovernor {
        endpoint.setSendVersion(_version);
    }

    function setReceiveVersion(uint16 _version) external override onlyGovernor {
        endpoint.setReceiveVersion(_version);
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override onlyGovernor {
        endpoint.forceResumeReceive(_srcChainId, _srcAddress);
    }

    /// @notice Set bridge destination
    /// @param zkLinkChainId zkLink chain id
    /// @param lzChainId LayerZero chain id
    /// @param contractAddr LayerZeroBridge contract address on other chains
    function setDestination(uint8 zkLinkChainId, uint16 lzChainId, bytes calldata contractAddr) external onlyGovernor {
        zkLinkChainIdToLZChainId[zkLinkChainId] = lzChainId;
        lzChainIdToZKLinkChainId[lzChainId] = zkLinkChainId;
        destinations[lzChainId] = contractAddr;
        emit UpdateDestination(zkLinkChainId, lzChainId, contractAddr);
    }

    function estimateSendSyncHashFee(bytes32 syncHash) external view returns (uint nativeFee) {
        uint16 dstChainId = zkLinkChainIdToLZChainId[MASTER_CHAIN_ID];
        checkDstChainId(dstChainId);
        bytes memory payload = buildSyncHashPayload(syncHash);
        (nativeFee, ) = endpoint.estimateFees(dstChainId, address(this), payload, false, new bytes(0));
    }

    function sendSyncHash(bytes32 syncHash) external override onlyZkLink payable {
        // ===Checks===
        // send msg to master chain
        uint16 dstChainId = zkLinkChainIdToLZChainId[MASTER_CHAIN_ID];
        bytes memory trustedRemote = checkDstChainId(dstChainId);

        // ===Interactions===
        // send LayerZero message
        bytes memory path = abi.encodePacked(trustedRemote, address(this));
        bytes memory payload = buildSyncHashPayload(syncHash);
        // solhint-disable-next-line check-send-result
        endpoint.send{value:msg.value}(dstChainId, path, payload, payable(tx.origin), address(0), new bytes(0));
    }

    function buildSyncHashPayload(bytes32 syncHash) internal pure returns (bytes memory payload) {
        payload = abi.encode(syncHash);
    }

    function estimateConfirmBlockFee(uint8 destZkLinkChainId, uint32 blockNumber) external view returns (uint nativeFee) {
        uint16 dstChainId = zkLinkChainIdToLZChainId[destZkLinkChainId];
        checkDstChainId(dstChainId);
        bytes memory payload = buildConfirmPayload(blockNumber);
        (nativeFee, ) = endpoint.estimateFees(dstChainId, address(this), payload, false, new bytes(0));
    }

    function confirmBlock(uint8 destZkLinkChainId, uint32 blockNumber) external override onlyZkLink payable {
        // ===Checks===
        uint16 dstChainId = zkLinkChainIdToLZChainId[destZkLinkChainId];
        bytes memory trustedRemote = checkDstChainId(dstChainId);

        // ===Interactions===
        // send LayerZero message
        bytes memory path = abi.encodePacked(trustedRemote, address(this));
        bytes memory payload = buildConfirmPayload(blockNumber);
        // solhint-disable-next-line check-send-result
        endpoint.send{value:msg.value}(dstChainId, path, payload, payable(tx.origin), address(0), new bytes(0));
    }

    function buildConfirmPayload(uint32 blockNumber) internal pure returns (bytes memory payload) {
        payload = abi.encode(blockNumber);
    }

    function _nonblockingLzReceive(uint16 srcChainId, bytes calldata /**srcAddress**/, uint64 /**nonce**/, bytes calldata payload) internal {
        // unpack payload
        uint8 zkLinkChainId = lzChainIdToZKLinkChainId[srcChainId];
        require(zkLinkChainId > 0, "zkLink chain id not config");
        if (CHAIN_ID == MASTER_CHAIN_ID) {
            bytes32 syncHash = abi.decode(payload, (bytes32));
            zklink.receiveSyncHash(zkLinkChainId, syncHash);
        } else {
            uint32 blockNumber = abi.decode(payload, (uint32));
            zklink.receiveBlockConfirmation(blockNumber);
        }
    }

    /// @notice Receive the bytes payload from the source chain via LayerZero
    /// @dev lzReceive can only be called by endpoint
    /// @dev srcPath(in UltraLightNodeV2) = abi.encodePacked(srcAddress, dstAddress);
    function lzReceive(uint16 srcChainId, bytes calldata srcPath, uint64 nonce, bytes calldata payload) external override onlyEndpoint nonReentrant {
        // reject invalid src contract address
        bytes memory srcAddress = destinations[srcChainId];
        bytes memory path = abi.encodePacked(srcAddress, address(this));
        require(keccak256(path) == keccak256(srcPath), "Invalid src");

        // try-catch all errors/exceptions
        // solhint-disable-next-line no-empty-blocks
        try this.nonblockingLzReceive(srcChainId, srcAddress, nonce, payload) {
            // do nothing
        } catch {
            // error / exception
            failedMessages[srcChainId][srcAddress][nonce] = keccak256(payload);
            emit MessageFailed(srcChainId, srcAddress, nonce, payload);
        }
    }

    function nonblockingLzReceive(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload) public {
        // only internal transaction
        require(msg.sender == address(this), "Caller must be this bridge");
        _nonblockingLzReceive(srcChainId, srcAddress, nonce, payload);
    }

    /// @notice Retry the failed message, payload hash must be exist
    function retryMessage(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload) external payable virtual nonReentrant {
        // assert there is message to retry
        bytes32 payloadHash = failedMessages[srcChainId][srcAddress][nonce];
        require(payloadHash != bytes32(0), "No stored message");
        require(keccak256(payload) == payloadHash, "Invalid payload");
        // clear the stored message
        failedMessages[srcChainId][srcAddress][nonce] = bytes32(0);
        // execute the message. revert if it fails again
        _nonblockingLzReceive(srcChainId, srcAddress, nonce, payload);
    }

    function checkDstChainId(uint16 dstChainId) internal view returns (bytes memory trustedRemote) {
        trustedRemote = destinations[dstChainId];
        require(trustedRemote.length > 0, "Trust remote not exist");
    }
}
