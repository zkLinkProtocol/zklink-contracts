// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./ILayerZeroReceiver.sol";
import "./ILayerZeroEndpoint.sol";
import "./LayerZeroStorage.sol";
import "../token/IZKL.sol";

/// @title LayerZero bridge implementation
/// @dev if message is blocking we should call `retryPayload` of endpoint to retry
/// the reasons for message blocking may be:
/// * `_dstAddress` is not deployed to dst chain, and we can deploy LayerZeroBridge to dst chain to fix it.
/// * lzReceive cost more gas than `_gasLimit` that endpoint send, and we can update `LZ_RECEIVE_GAS_*` constant to fix it.
/// * lzReceive reverted unexpected, and we can fix bug and upgrade contract to fix it.
/// ILayerZeroUserApplicationConfig does not need to be implemented for now
/// @author zk.link
contract LayerZeroBridge is ReentrancyGuardUpgradeable, UUPSUpgradeable, OwnableUpgradeable, LayerZeroStorage, ILayerZeroReceiver {

    /// @dev Put `initializer` modifier here to prevent anyone call this function from proxy after we initialized
    /// No delegatecall exist in this contract, so it's ok to expose this function in logic
    /// @param _endpoint The LayerZero endpoint
    function initialize(address _endpoint) public initializer {
        require(_endpoint != address(0), "Endpoint not set");

        __ReentrancyGuard_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        endpoint = _endpoint;
    }

    /// @dev Only owner can upgrade logic contract
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Set bridge destination
    /// @param dstChainId LayerZero chain id on other chains
    /// @param contractAddr LayerZeroBridge contract address on other chains
    function setDestination(uint16 dstChainId, bytes calldata contractAddr) external onlyOwner {
        require(dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        destinations[dstChainId] = contractAddr;
        emit UpdateDestination(dstChainId, contractAddr);
    }

    /// @notice Set destination address length
    /// @param dstChainId LayerZero chain id on other chains
    /// @param addressLength Address length
    function setDestinationAddressLength(uint16 dstChainId, uint8 addressLength) external onlyOwner {
        require(dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        destAddressLength[dstChainId] = addressLength;
        emit UpdateDestinationAddressLength(dstChainId, addressLength);
    }

    /// @notice Set app contract address
    /// @param app The app type
    /// @param contractAddress The app contract address
    function setApp(APP app, address contractAddress) external onlyOwner {
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

    // todo estimateRootHashBridgeFees

    /// @notice Bridge zkl to other chain
    /// @param from the account burned from
    /// @param dstChainId the destination chainId
    /// @param receiver the destination receiver address
    /// @param amount the amount to bridge
    /// @param refundAddress native fees(collected by oracle and relayer) refund address if msg.value is too large
    /// @param zroPaymentAddress if not zero user will use ZRO token to pay layerzero protocol fees(not oracle or relayer fees)
    /// @param adapterParams see https://layerzero.gitbook.io/docs/guides/advanced/relayer-adapter-parameters
    function bridgeZKL(address from,
        uint16 dstChainId,
        bytes calldata receiver,
        uint256 amount,
        address payable refundAddress,
        address zroPaymentAddress,
        bytes calldata adapterParams
    ) external nonReentrant payable {
        // to avoid stack too deep
        address _from = from;
        uint16 _dstChainId = dstChainId;
        bytes memory _receiver = receiver;
        uint256 _amount = amount;
        address payable _refundAddress = refundAddress;
        address _zroPaymentAddress = zroPaymentAddress;
        bytes memory _adapterParams = adapterParams;
        // ===Checks===
        require(_dstChainId != ILayerZeroEndpoint(endpoint).getChainId(), "Invalid dstChainId");
        bytes memory trustedRemote = destinations[_dstChainId];
        require(trustedRemote.length > 0, "Trust remote not exist");

        uint8 destAddressLength = destAddressLength[_dstChainId];
        if (destAddressLength == 0) {
            destAddressLength = EVM_ADDRESS_LENGTH;
        }
        require(_receiver.length == destAddressLength, "Invalid receiver");

        require(amount > 0, "Amount not set");

        address zkl = apps[APP.ZKL];
        require(zkl != address(0), "Bridge zkl not support");

        // endpoint will check `refundAddress`, `zroPaymentAddress` and `adapterParams`

        // ===Interactions===
        address spender = _msgSender();
        // send LayerZero message
        bytes memory payload = buildZKLBridgePayload(_receiver, _amount);
        // solhint-disable-next-line check-send-result
        ILayerZeroEndpoint(endpoint).send{value:msg.value}(_dstChainId, trustedRemote, payload, _refundAddress, _zroPaymentAddress, _adapterParams);

        // burn token of `from`, it will be reverted if `amount` is over the balance of `from`
        uint64 nonce = ILayerZeroEndpoint(endpoint).getOutboundNonce(_dstChainId, address(this));
        IZKL(zkl).bridgeTo(spender, _from, _dstChainId, _receiver, _amount, nonce);
    }

    // todo bridge root hash

    /// @notice Receive the bytes payload from the source chain via LayerZero and mint token to receiver
    /// @dev lzReceive can only be called by endpoint
    function lzReceive(uint16 srcChainId, bytes calldata srcAddress, uint64 nonce, bytes calldata payload) external override onlyEndpoint nonReentrant {
        // reject invalid src contract address
        bytes memory trustedRemote = destinations[srcChainId];
        require(srcAddress.length == trustedRemote.length && keccak256(trustedRemote) == keccak256(srcAddress), "Invalid src");

        // unpack payload
        APP app = APP(uint8(payload[0]));
        if (app == APP.ZKL) {
            address zkl = apps[APP.ZKL];
            require(zkl != address(0), "Bridge zkl not support");

            (bytes memory receiverBytes, uint amount) = abi.decode(payload[1:], (bytes, uint));
            address receiver;
            assembly {
                receiver := mload(add(receiverBytes, 20))
            }
            // mint token to receiver
            IZKL(zkl).bridgeFrom(srcChainId, receiver, amount, nonce);
        } else if (app == APP.ZKLINK) {
            // todo receive RootHash
        } else {
            revert("APP not support");
        }
    }

    function buildZKLBridgePayload(bytes memory receiver, uint256 amount) internal pure returns (bytes memory payload) {
        payload = abi.encodePacked(APP.ZKL, abi.encode(receiver, amount));
    }
}
