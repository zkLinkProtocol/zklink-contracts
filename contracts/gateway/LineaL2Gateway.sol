// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ILineaL2Gateway} from "../interfaces/ILineaL2Gateway.sol";
import {IMessageService} from "../interfaces/linea/IMessageService.sol";
import {IZkLink} from "../interfaces/IZkLink.sol";
import {ITokenBridge} from "../interfaces/linea/ITokenBridge.sol";

contract LineaL2Gateway is OwnableUpgradeable, UUPSUpgradeable, ILineaL2Gateway {
    uint8 public constant INBOX_STATUS_UNKNOWN = 0;
    uint8 public constant INBOX_STATUS_RECEIVED = 1;
    uint8 public constant INBOX_STATUS_CLAIMED = 2;

    struct UsdcInfo {
        address token;
        address bridge;
        address remoteBridge;
        address remoteToken;
    }

    /// @notice Claim fee recipient
    address payable public feeRecipient;

    /// @notice message service address
    IMessageService public messageService;

    /// @notice Remote Gateway address
    address public remoteGateway;

    /// @notice zklink contract of linea
    address public zklinkContract;

    /// @notice linea token bridge address
    address public tokenBridge;

    /// @dev linea usdc token and bridge info
    UsdcInfo public usdcInfo;

    /// @dev Mapping from messageHash to bool
    mapping(bytes32 => bool) internal messageHashUsed;

    /// @notice current claim messageHash
    bytes32 public messageHash;

    modifier onlyMessageService() {
        require(msg.sender == address(messageService), "M0");
        _;
    }

    function initialize(IMessageService _messageService, address _zklinkContract, address _tokenBridge, UsdcInfo calldata _usdcInfo) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        messageService = _messageService;
        zklinkContract = _zklinkContract;
        tokenBridge = _tokenBridge;
        usdcInfo = _usdcInfo;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// claim deposit ERC20 message
    /// @param _token L2 ERC20 token address
    /// @param _calldata deposit ERC20 message calldata
    /// @param _nonce deposit ETC20 message nonce
    /// @param _cbCalldata verify params message calldata
    /// @param _cbNonce verify params message nonce
    function claimDepositERC20(address _token, bytes calldata _calldata, uint256 _nonce, bytes calldata _cbCalldata, uint256 _cbNonce) external override {
        if (_token == usdcInfo.token) {
            _claimERC20(usdcInfo.remoteBridge, usdcInfo.bridge, _calldata, _nonce);
        } else {
            _claimERC20(ITokenBridge(tokenBridge).remoteSender(), tokenBridge, _calldata, _nonce);
        }

        // claim callback message to verify messages
        messageService.claimMessage(remoteGateway, address(this), 0, 0, feeRecipient, _cbCalldata, _cbNonce);
    }

    /// claim deposit ERC20 verify params callback
    /// @param _token L2 ERC20 token address
    /// @param _amount amount to deposit
    /// @param _zkLinkAddress zklink address.
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    /// @param _messageHash linea bridge deposit messageHash
    function claimDepositERC20Callback(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping,
        bytes32 _messageHash
    ) external override onlyMessageService {
        require(messageHash == _messageHash, "M2");

        // approve token to zklink
        IERC20(_token).approve(zklinkContract, _amount);

        // deposit erc20 to zklink
        (bool success, bytes memory errorInfo) = zklinkContract.call(abi.encodeCall(IZkLink.depositERC20, (IERC20(_token), _amount, _zkLinkAddress, _subAccountId, _mapping)));

        if (success) {
            messageHashUsed[messageHash] = true;
        }

        // reset messageHash
        messageHash = bytes32(0);

        emit ClaimedDepositERC20(_token, _amount, _zkLinkAddress, _subAccountId, _mapping, success, errorInfo);
    }

    function claimDepositETH(bytes calldata _calldata, uint256 _nonce, uint256 _amount) external override {
        messageService.claimMessage(remoteGateway, address(this), 0, _amount, feeRecipient, _calldata, _nonce);
    }

    /// claim deposit ETH message hash
    /// @param zkLinkAddress zklink address
    /// @param subAccountId sub account id
    /// @param amount amount to deposit
    function claimDepositETHCallback(bytes32 zkLinkAddress, uint8 subAccountId, uint104 amount) external payable override onlyMessageService {
        require(msg.value == amount, "V0");

        (bool success, bytes memory errorInfo) = zklinkContract.call{value: msg.value}(abi.encodeCall(IZkLink.depositETH, (zkLinkAddress, subAccountId)));

        emit ClaimedDepositETH(zkLinkAddress, subAccountId, amount, success, errorInfo);
    }

    function _claimERC20(address _remoteBirdge, address _bridge, bytes calldata _calldata, uint256 _nonce) internal {
        messageHash = keccak256(abi.encode(_remoteBirdge, _bridge, 0, 0, _nonce, _calldata));

        uint256 status = messageService.inboxL1L2MessageStatus(messageHash);
        require(status != INBOX_STATUS_UNKNOWN, "M1");

        // if status == INBOX_STATUS_CLAIMED means someone else claimed erc20 token directly
        if (status == INBOX_STATUS_RECEIVED) {
            // claim erc20 token
            (bool success, bytes memory errorInfo) = address(messageService).call(
                abi.encodeCall(IMessageService.claimMessage, (_remoteBirdge, _bridge, 0, 0, feeRecipient, _calldata, _nonce))
            );

            require(success, string(errorInfo));
        }
    }

    /// batch check whether messageHash can claim
    /// @param messageHashs: L1 messageHash
    function checkMessageStatus(bytes32[] calldata messageHashs) external view returns (uint256[] memory) {
        uint256[] memory status = new uint256[](messageHashs.length);
        for (uint i = 0; i < messageHashs.length; i++) {
            status[i] = messageService.inboxL1L2MessageStatus(messageHashs[i]);
        }
        return status;
    }
}
