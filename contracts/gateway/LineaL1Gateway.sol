// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ILineaERC20Bridge} from "../interfaces/linea/ILineaERC20Bridge.sol";
import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {ILineaL1Gateway} from "../interfaces/ILineaL1Gateway.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";

contract LineaL1Gateway is OwnableUpgradeable, UUPSUpgradeable, ILineaL1Gateway {
    /// @dev Address represent eth when deposit or withdraw
    address internal constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    // Special addresses used in the mappings to mark specific states for tokens.
    /// @notice EMPTY means a token is not present in the mapping.
    address internal constant EMPTY = address(0x0);
    /// @notice RESERVED means a token is reserved and cannot be bridged.
    address internal constant RESERVED_STATUS = address(0x111);
    /// @notice NATIVE means a token is native to the current local chain.
    address internal constant NATIVE_STATUS = address(0x222);
    /// @notice DEPLOYED means the bridged token contract has been deployed on the remote chain.
    address internal constant DEPLOYED_STATUS = address(0x333);
    struct UsdcInfo {
        address token;
        address bridge;
        address remoteBridge;
        address remoteToken;
    }

    /// @notice L2 claim message gas fee users should pay for
    uint64 public fee;

    /// @notice Used to prevent off-chain monitoring events from being lost
    uint192 public txNonce;

    /// @notice linea message service address
    IMessageService public messageService;

    /// @notice Remote Gateway address
    address public remoteGateway;

    /// @notice linea token bridge address
    address public tokenBridge;

    /// @dev linea usdc token and bridge info
    UsdcInfo public usdcInfo;

    modifier zeroAddressCheck(address addressToSet) {
        require(addressToSet != address(0), "Z0");
        _;
    }

    function initialize(IMessageService _messageService, address _tokenBridge, UsdcInfo calldata _usdcInfo) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        messageService = _messageService;
        tokenBridge = _tokenBridge;
        usdcInfo = _usdcInfo;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) external payable override {
        if (fee > 0) {
            require(msg.value == fee, "F0");
        }

        if (_token == usdcInfo.token) {
            _depositUSDC(_token, _amount, _zkLinkAddress, _subAccountId, _mapping);
        } else {
            _depositERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping);
        }
    }

    function depositETH(bytes32 _zkLinkAddress, uint8 _subAccountId) external payable override {
        require(msg.value < 2 ** 128, "16");
        uint104 amount = fee > 0 ? uint104(msg.value) - fee : uint104(msg.value);

        uint256 nonce = messageService.nextMessageNumber();
        bytes memory _calldata = abi.encodeCall(ILineaL2Gateway.claimDepositETHCallback, (_zkLinkAddress, _subAccountId, amount));

        messageService.sendMessage{value: msg.value}(remoteGateway, 0, _calldata);

        txNonce++;
        emit Deposit(ETH_ADDRESS, amount, _zkLinkAddress, _subAccountId, false, _calldata, nonce, new bytes(0), bytes32(0), txNonce);
    }

    function _depositUSDC(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) internal {
        require(usdcInfo.token != address(0) && usdcInfo.bridge != address(0) && usdcInfo.remoteBridge != address(0) && usdcInfo.remoteToken != address(0), "T0");

        // bridge deposit can ensure success
        _depositAndApprove(_token, usdcInfo.bridge, _amount);

        // bridge usdc
        (uint256 nonce, bytes memory _calldata, bytes32 messageHash) = _bridgeUSDC(_amount);

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            ILineaL2Gateway.claimDepositERC20Callback,
            (usdcInfo.remoteToken, _amount, _zkLinkAddress, _subAccountId, _mapping, messageHash)
        );
        messageService.sendMessage(remoteGateway, 0, verifyCalldata);

        txNonce++;
        emit Deposit(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, _calldata, nonce, verifyCalldata, messageHash, txNonce);
    }

    function _depositERC20(address _token, uint104 _amount, bytes32 _zkLinkAddress, uint8 _subAccountId, bool _mapping) internal {
        // bridge deposit can ensure success
        _depositAndApprove(_token, tokenBridge, _amount);

        // bridge ERC20 token
        (uint256 nonce, bytes memory _calldata, bytes32 messageHash) = _bridgeERC20(_token, _amount);

        // sendClaimERC20 message
        bytes memory verifyCalldata = abi.encodeCall(
            ILineaL2Gateway.claimDepositERC20Callback,
            (ITokenBridge(tokenBridge).bridgedToNativeToken(_token), _amount, _zkLinkAddress, _subAccountId, _mapping, messageHash)
        );
        messageService.sendMessage(remoteGateway, 0, verifyCalldata);

        txNonce++;
        emit Deposit(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, _calldata, nonce, verifyCalldata, messageHash, txNonce);
    }

    function _depositAndApprove(address _token, address _bridge, uint104 _amount) internal {
        IERC20Upgradeable(_token).transferFrom(msg.sender, address(this), _amount);
        IERC20Upgradeable(_token).approve(_bridge, _amount);
    }

    function _bridgeUSDC(uint104 _amount) internal returns (uint256 nonce, bytes memory _calldata, bytes32 messageHash) {
        nonce = messageService.nextMessageNumber();
        _calldata = abi.encodeCall(ILineaERC20Bridge.receiveFromOtherLayer, (remoteGateway, _amount));
        messageHash = keccak256(abi.encode(usdcInfo.bridge, usdcInfo.remoteBridge, 0, 0, nonce, _calldata));

        ILineaERC20Bridge(usdcInfo.bridge).depositTo(_amount, remoteGateway);
    }

    function _bridgeERC20(address _token, uint104 _amount) internal returns (uint256 nonce, bytes memory _calldata, bytes32 messageHash) {
        // bridge erc20
        nonce = messageService.nextMessageNumber();

        bytes memory tokenMetadata;
        address nativeMappingValue = ITokenBridge(tokenBridge).nativeToBridgedToken(_token);
        if (nativeMappingValue != DEPLOYED_STATUS) {
            tokenMetadata = _getMetdata(_token);
        }
        _calldata = abi.encodeCall(ITokenBridge.completeBridging, (_token, _amount, remoteGateway, tokenMetadata));

        messageHash = keccak256(abi.encode(tokenBridge, ITokenBridge(tokenBridge).remoteSender(), 0, 0, nonce, _calldata));

        ITokenBridge(tokenBridge).bridgeToken(_token, _amount, remoteGateway);
    }

    function _getMetdata(address _token) internal view returns (bytes memory) {
        (string memory name, string memory symbol, uint8 decimals) = getMetdata(_token);
        return abi.encode(name, symbol, decimals);
    }

    /// set fee
    /// @param _fee L2 claim message gas fee
    function setFee(uint64 _fee) external onlyOwner {
        fee = _fee;
        emit SetFee(_fee);
    }

    /// @notice set remote Gateway address
    /// @param _remoteGateway remote gateway address
    function setRemoteGateway(address _remoteGateway) external zeroAddressCheck(_remoteGateway) onlyOwner {
        remoteGateway = _remoteGateway;
    }

    /// withdraw fees
    /// @param receiver receiver address
    function withdrawFee(address payable receiver) external onlyOwner {
        receiver.transfer(address(this).balance);
    }

    function getMetdata(address _token) public view returns (string memory name, string memory symbol, uint8 decimals) {
        name = bytes(IERC20MetadataUpgradeable(_token).name()).length > 0 ? IERC20MetadataUpgradeable(_token).name() : "NO_NAME";
        symbol = bytes(IERC20MetadataUpgradeable(_token).symbol()).length > 0 ? IERC20MetadataUpgradeable(_token).symbol() : "NO_SYMBOL";
        decimals = IERC20MetadataUpgradeable(_token).decimals() > 0 ? IERC20MetadataUpgradeable(_token).decimals() : 18;
    }
}
