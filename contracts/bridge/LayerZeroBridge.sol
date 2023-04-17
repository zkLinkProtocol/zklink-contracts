// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ILayerZeroReceiver.sol";
import "./ILayerZeroEndpoint.sol";
import "./ILayerZeroUserApplicationConfig.sol";
import "./LayerZeroStorage.sol";
import "../zksync/ReentrancyGuard.sol";

/// @title LayerZero bridge implementation of non-blocking model
/// @dev if message is blocking we should call `retryPayload` of endpoint to retry
/// the reasons for message blocking may be:
/// * `_dstAddress` is not deployed to dst chain, and we can deploy LayerZeroBridge to dst chain to fix it.
/// * lzReceive cost more gas than `_gasLimit` that endpoint send, and user should call `retryMessage` to fix it.
/// * lzReceive reverted unexpected, and we can fix bug and deploy a new contract to fix it.
/// @author zk.link
contract LayerZeroBridge is ReentrancyGuard, LayerZeroStorage, ILayerZeroReceiver, ILayerZeroUserApplicationConfig {

    // to avoid stack too deep
    struct LzBridgeParams {
        uint16 dstChainId; // the destination chainId
        address payable refundAddress; // native fees refund address if msg.value is too large
        address zroPaymentAddress; // if not zero user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
        bytes adapterParams; // see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    }

    modifier onlyEndpoint {
        require(msg.sender == address(endpoint), "Require endpoint");
        _;
    }

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, "Caller is not governor");
        _;
    }

    receive() external payable {}

    /// @param _governor The network governor of zkLink protocol
    /// @param _zklink The zklink contract address
    /// @param _endpoint The LayerZero endpoint
    constructor(address _governor, address _zklink, ILayerZeroEndpoint _endpoint) {
        require(_governor != address(0), "Governor not set");
        require(_zklink != address(0), "ZkLink not set");
        require(address(_endpoint) != address(0), "Endpoint not set");

        initializeReentrancyGuard();

        networkGovernor = _governor;
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
    /// @param dstChainId LayerZero chain id on other chains
    /// @param contractAddr LayerZeroBridge contract address on other chains
    function setDestination(uint16 dstChainId, bytes calldata contractAddr) external onlyGovernor {
        require(dstChainId != endpoint.getChainId(), "Invalid dstChainId");
        destinations[dstChainId] = contractAddr;
        emit UpdateDestination(dstChainId, contractAddr);
    }

    /// @notice Estimate bridge ZkLink Block fees
    /// @param lzChainId the destination chainId
    /// @param syncHash the sync hash of stored block
    /// @param progress the sync progress
    /// @param useZro if true user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
    /// @param adapterParams see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    function estimateZkLinkBlockBridgeFees(
        uint16 lzChainId,
        bytes32 syncHash,
        uint256 progress,
        bool useZro,
        bytes calldata adapterParams
    ) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = buildZkLinkBlockBridgePayload(syncHash, progress);
        return endpoint.estimateFees(lzChainId, address(this), payload, useZro, adapterParams);
    }

    /// @notice Bridge ZkLink block to other chain
    /// @param storedBlockInfo the block proved but not executed at the current chain
    /// @param dstChainIds dst chains to bridge, empty array will be reverted
    /// @param refundAddress native fees refund address if msg.value is too large
    /// @param zroPaymentAddress if not zero user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
    /// @param adapterParams see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    function bridgeZkLinkBlock(
        IZkLink.StoredBlockInfo calldata storedBlockInfo,
        uint16[] memory dstChainIds,
        address payable refundAddress,
        address zroPaymentAddress,
        bytes memory adapterParams
    ) external nonReentrant payable {
        // ===Checks===
        require(dstChainIds.length > 0, "No dst chain");

        // ===Interactions===
        bytes32 syncHash = storedBlockInfo.syncHash;
        uint256 progress = IZkLink(zklink).getSynchronizedProgress(storedBlockInfo);

        uint256 originBalance = address(this).balance - msg.value; // overflow is impossible
        // before the last send, we send all balance of this contract and set refund address to this contract
        for (uint i = 0; i < dstChainIds.length - 1; ++i) { // overflow is impossible
            _bridgeZkLinkBlockProgress(syncHash, progress, dstChainIds[i], payable(address(this)), zroPaymentAddress, adapterParams, address(this).balance);
        }
        // for the last send, we send all left value exclude the origin balance of this contract and set refund address to `refundAddress`
        require(address(this).balance > originBalance, "Msg value is not enough for the last send");
        uint256 leftMsgValue = address(this).balance - originBalance; // overflow is impossible
        _bridgeZkLinkBlockProgress(syncHash, progress, dstChainIds[dstChainIds.length - 1], refundAddress, zroPaymentAddress, adapterParams, leftMsgValue);
    }

    function _bridgeZkLinkBlockProgress(
        bytes32 syncHash,
        uint256 progress,
        uint16 dstChainId,
        address payable refundAddress,
        address zroPaymentAddress,
        bytes memory adapterParams,
        uint256 bridgeFee
    ) internal {
        // ===Checks===
        bytes memory trustedRemote = checkDstChainId(dstChainId);

        // endpoint will check `refundAddress`, `zroPaymentAddress` and `adapterParams`

        // ===Effects===
        uint64 nonce = endpoint.getOutboundNonce(dstChainId, address(this));
        emit SendSynchronizationProgress(dstChainId, nonce + 1, syncHash, progress);

        // ===Interactions===
        // send LayerZero message
        bytes memory path = abi.encodePacked(trustedRemote, address(this));
        bytes memory payload = buildZkLinkBlockBridgePayload(syncHash, progress);
        // solhint-disable-next-line check-send-result
        endpoint.send{value:bridgeFee}(dstChainId, path, payload, refundAddress, zroPaymentAddress, adapterParams);
    }

    /// @notice Receive the bytes payload from the source chain via LayerZero
    /// @dev lzReceive can only be called by endpoint
    /// @dev srcPath(in UltraLightNodeV2) = abi.encodePacked(srcAddress, dstAddress);
    function lzReceive(uint16 srcChainId, bytes calldata srcPath, uint64 nonce, bytes calldata payload) external override onlyEndpoint nonReentrant {
        // reject invalid src contract address
        bytes memory srcAddress = destinations[srcChainId];
        bytes memory path = abi.encodePacked(srcAddress, address(this));
        require(path.length == srcPath.length && keccak256(path) == keccak256(srcPath), "Invalid src");

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

    function _nonblockingLzReceive(uint16 srcChainId, bytes calldata /**srcAddress**/, uint64 nonce, bytes calldata payload) internal {
        // unpack payload
        (bytes32 syncHash, uint256 progress) = abi.decode(payload, (bytes32, uint256));
        emit ReceiveSynchronizationProgress(srcChainId, nonce, syncHash, progress);
        IZkLink(zklink).receiveSynchronizationProgress(syncHash, progress);
    }

    function checkDstChainId(uint16 dstChainId) internal view returns (bytes memory trustedRemote) {
        trustedRemote = destinations[dstChainId];
        require(trustedRemote.length > 0, "Trust remote not exist");
    }

    function buildZkLinkBlockBridgePayload(bytes32 syncHash, uint256 progress) internal pure returns (bytes memory payload) {
        payload = abi.encode(syncHash, progress);
    }
}

interface IZkLink {
    // stored block info of ZkLink
    struct StoredBlockInfo {
        uint32 blockNumber;
        uint64 priorityOperations;
        bytes32 pendingOnchainOperationsHash;
        uint256 timestamp;
        bytes32 stateHash;
        bytes32 commitment;
        bytes32 syncHash;
    }

    /// @notice Get synchronized progress of zkLink contract known on deployed chain
    function getSynchronizedProgress(StoredBlockInfo memory block) external view returns (uint256 progress);

    /// @notice Combine the `progress` of the other chains of a `syncHash` with self
    function receiveSynchronizationProgress(bytes32 syncHash, uint256 progress) external;
}
