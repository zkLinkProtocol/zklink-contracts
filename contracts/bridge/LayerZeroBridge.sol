// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./ILayerZeroReceiver.sol";
import "./ILayerZeroEndpoint.sol";
import "./LayerZeroStorage.sol";
import "../token/IZKL.sol";

/// @title LayerZero bridge implementation of non-blocking model
/// @dev if message is blocking we should call `retryPayload` of endpoint to retry
/// the reasons for message blocking may be:
/// * `_dstAddress` is not deployed to dst chain, and we can deploy LayerZeroBridge to dst chain to fix it.
/// * lzReceive cost more gas than `_gasLimit` that endpoint send, and user should call `retryMessage` to fix it.
/// * lzReceive reverted unexpected, and we can fix bug and upgrade contract to fix it.
/// ILayerZeroUserApplicationConfig does not need to be implemented for now
/// @author zk.link
contract LayerZeroBridge is ReentrancyGuardUpgradeable, UUPSUpgradeable, LayerZeroStorage, ILayerZeroReceiver {

    // to avoid stack too deep
    struct LzBridgeParams {
        uint16 dstChainId; // the destination chainId
        address payable refundAddress; // native fees(collected by oracle and relayer) refund address if msg.value is too large
        address zroPaymentAddress; // if not zero user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
        bytes adapterParams; // see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    }

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, "Caller is not governor");
        _;
    }

    /// @dev Put `initializer` modifier here to prevent anyone call this function from proxy after we initialized
    /// No delegatecall exist in this contract, so it's ok to expose this function in logic
    /// @param _endpoint The LayerZero endpoint
    function initialize(address _governor, address _endpoint) public initializer {
        require(_governor != address(0), "Governor not set");
        require(_endpoint != address(0), "Endpoint not set");

        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        networkGovernor = _governor;
        endpoint = _endpoint;
    }

    /// @dev Only owner can upgrade logic contract
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyGovernor {}

    /// @notice Set bridge destination
    /// @param dstChainId LayerZero chain id on other chains
    /// @param contractAddr LayerZeroBridge contract address on other chains
    function setDestination(uint16 dstChainId, bytes calldata contractAddr) external onlyGovernor {
        require(dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        destinations[dstChainId] = contractAddr;
        emit UpdateDestination(dstChainId, contractAddr);
    }

    /// @notice Set destination address length
    /// @param dstChainId LayerZero chain id on other chains
    /// @param addressLength Address length
    function setDestinationAddressLength(uint16 dstChainId, uint8 addressLength) external onlyGovernor {
        require(dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        destAddressLength[dstChainId] = addressLength;
        emit UpdateDestinationAddressLength(dstChainId, addressLength);
    }

    /// @notice Set app contract address
    /// @param app The app type
    /// @param contractAddress The app contract address
    function setApp(APP app, address contractAddress) external onlyGovernor {
        apps[app] = contractAddress;
        emit UpdateAPP(app, contractAddress);
    }

    /// @notice Estimate bridge zkl fees
    /// @param lzChainId the destination chainId
    /// @param receiver the destination receiver address
    /// @param amount the token amount to bridge
    /// @param useZro if true user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
    /// @param adapterParams see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    function estimateZKLBridgeFees(uint16 lzChainId,
        bytes calldata receiver,
        uint256 amount,
        bool useZro,
        bytes calldata adapterParams
    ) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = buildZKLBridgePayload(receiver, amount);
        return ILayerZeroEndpoint(endpoint).estimateFees(lzChainId, address(this), payload, useZro, adapterParams);
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
        return ILayerZeroEndpoint(endpoint).estimateFees(lzChainId, address(this), payload, useZro, adapterParams);
    }

    /// @notice Bridge zkl to other chain
    /// @param from the account burned from
    /// @param receiver the destination receiver address
    /// @param amount the amount to bridge
    /// @param params lz params
    function bridgeZKL(
        address from,
        bytes calldata receiver,
        uint256 amount,
        LzBridgeParams calldata params
    ) external nonReentrant payable {
        uint16 _dstChainId = params.dstChainId;
        // ===Checks===
        bytes memory trustedRemote = checkDstChainId(_dstChainId);

        uint8 destAddressLength = destAddressLength[_dstChainId];
        if (destAddressLength == 0) {
            destAddressLength = EVM_ADDRESS_LENGTH;
        }
        require(receiver.length == destAddressLength, "Invalid receiver");

        require(amount > 0, "Amount not set");

        address zkl = apps[APP.ZKL];
        require(zkl != address(0), "ZKL not support");

        // endpoint will check `refundAddress`, `zroPaymentAddress` and `adapterParams`

        // ===Interactions===
        // send LayerZero message
        {
            bytes memory payload = buildZKLBridgePayload(receiver, amount);
            // solhint-disable-next-line check-send-result
            ILayerZeroEndpoint(endpoint).send{value:msg.value}(_dstChainId, trustedRemote, payload, params.refundAddress, params.zroPaymentAddress, params.adapterParams);
        }

        // burn token of `from`, it will be reverted if `amount` is over the balance of `from`
        uint64 nonce = ILayerZeroEndpoint(endpoint).getOutboundNonce(_dstChainId, address(this));
        IZKL(zkl).bridgeTo(_dstChainId, nonce, msg.sender, from, receiver, amount);
    }

    /// @notice Bridge ZkLink block to other chain
    /// @param storedBlockInfo the block proved but not executed at the current chain
    /// @param params lz params
    function bridgeZkLinkBlock(
        IZkLink.StoredBlockInfo calldata storedBlockInfo,
        LzBridgeParams calldata params
    ) external nonReentrant payable {
        uint16 _dstChainId = params.dstChainId;
        // ===Checks===
        bytes memory trustedRemote = checkDstChainId(_dstChainId);

        address zklink = apps[APP.ZKLINK];
        require(zklink != address(0), "ZKLINK not support");

        // endpoint will check `refundAddress`, `zroPaymentAddress` and `adapterParams`

        // ===Interactions===
        // send LayerZero message
        uint256 progress = IZkLink(zklink).getSynchronizedProgress(storedBlockInfo);
        bytes memory payload = buildZkLinkBlockBridgePayload(storedBlockInfo.syncHash, progress);
        // solhint-disable-next-line check-send-result
        ILayerZeroEndpoint(endpoint).send{value:msg.value}(_dstChainId, trustedRemote, payload, params.refundAddress, params.zroPaymentAddress, params.adapterParams);
    }

    /// @notice Receive the bytes payload from the source chain via LayerZero
    /// @dev lzReceive can only be called by endpoint
    function lzReceive(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload) external override onlyEndpoint nonReentrant {
        // reject invalid src contract address
        bytes memory trustedRemote = destinations[srcChainId];
        require(srcAddress.length == trustedRemote.length && keccak256(trustedRemote) == keccak256(srcAddress), "Invalid src");

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
    function retryMessage(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload) external payable virtual {
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
        APP app = APP(uint8(payload[0]));
        if (app == APP.ZKL) {
            address zkl = apps[APP.ZKL];

            (bytes memory receiverBytes, uint256 amount) = abi.decode(payload[1:], (bytes, uint256));
            address receiver;
            assembly {
                receiver := mload(add(receiverBytes, EVM_ADDRESS_LENGTH))
            }
            // mint token to receiver
            IZKL(zkl).bridgeFrom(srcChainId, nonce, receiver, amount);
        } else if (app == APP.ZKLINK) {
            address zklink = apps[APP.ZKLINK];

            (bytes32 syncHash, uint256 progress) = abi.decode(payload[1:], (bytes32, uint256));
            IZkLink(zklink).receiveSynchronizationProgress(srcChainId, nonce, syncHash, progress);
        } else {
            revert("APP not support");
        }
    }

    function checkDstChainId(uint16 dstChainId) internal view returns (bytes memory trustedRemote) {
        require(dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        trustedRemote = destinations[dstChainId];
        require(trustedRemote.length > 0, "Trust remote not exist");
    }

    function buildZKLBridgePayload(bytes memory receiver, uint256 amount) internal pure returns (bytes memory payload) {
        payload = abi.encodePacked(APP.ZKL, abi.encode(receiver, amount));
    }

    function buildZkLinkBlockBridgePayload(bytes32 syncHash, uint256 progress) internal pure returns (bytes memory payload) {
        payload = abi.encodePacked(APP.ZKLINK, abi.encode(syncHash, progress));
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

    function getSynchronizedProgress(StoredBlockInfo memory block) external view returns (uint256 progress);

    function receiveSynchronizationProgress(uint16 srcChainId, uint64 nonce, bytes32 syncHash, uint256 progress) external;
}
