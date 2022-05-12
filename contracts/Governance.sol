// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Config.sol";
import "./IGovernance.sol";

/// @title Governance Contract
/// @author zk.link
contract Governance is Config, IGovernance {
    /// @notice Token added to ZkLink net
    event NewToken(uint16 indexed tokenId, address indexed token);

    /// @notice Governor changed
    event NewGovernor(address newGovernor);

    /// @notice Validator's status changed
    event ValidatorStatusUpdate(address indexed validatorAddress, bool isActive);

    /// @notice Token pause status update
    event TokenPausedUpdate(uint16 indexed token, bool paused);

    /// @notice New bridge added
    event AddBridge(address indexed bridge);

    /// @notice Bridge update
    event UpdateBridge(uint256 indexed bridgeIndex, bool enableBridgeTo, bool enableBridgeFrom);

    /// @notice Address which will exercise governance over the network i.e. add tokens, change validator set, conduct upgrades
    address public override networkGovernor;

    /// @notice List of permitted validators
    mapping(address => bool) public validators;

    struct RegisteredToken {
        bool registered; // whether token registered to ZkLink or not, default is false
        bool paused; // whether token can deposit to ZkLink or not, default is false
        address tokenAddress; // the token address
    }

    /// @notice A map of registered token infos
    mapping(uint16 => RegisteredToken) public tokens;

    /// @notice A map of token address to id, 0 is invalid token id
    mapping(address => uint16) public tokenIds;

    /// @dev We can set `enableBridgeTo` and `enableBridgeTo` to false to disable bridge when `bridge` is compromised
    struct BridgeInfo {
        address bridge;
        bool enableBridgeTo;
        bool enableBridgeFrom;
    }

    /// @notice bridges
    BridgeInfo[] public bridges;
    // 0 is reversed for non-exist bridge, existing bridges are indexed from 1
    mapping(address => uint256) public bridgeIndex;

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, "Caller is not governor");
        _;
    }

    /// @notice Governance contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    ///     _networkGovernor The address of network governor
    function initialize(bytes calldata initializationParameters) external {
        address _networkGovernor = abi.decode(initializationParameters, (address));

        networkGovernor = _networkGovernor;
    }

    /// @notice Governance contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    // solhint-disable-next-line no-empty-blocks
    function upgrade(bytes calldata upgradeParameters) external {}

    /// @notice Change current governor
    /// @param _newGovernor Address of the new governor
    function changeGovernor(address _newGovernor) external onlyGovernor {
        require(_newGovernor != address(0), "Governor not set");
        if (networkGovernor != _newGovernor) {
            networkGovernor = _newGovernor;
            emit NewGovernor(_newGovernor);
        }
    }

    /// @notice Add token to the list of networks tokens
    /// @param _tokenId Token id
    /// @param _tokenAddress Token address
    function addToken(uint16 _tokenId, address _tokenAddress) public onlyGovernor {
        // token id MUST be in a valid range
        require(_tokenId > 0 && _tokenId < MAX_AMOUNT_OF_REGISTERED_TOKENS, "Invalid token id");
        // token MUST be not zero address
        require(_tokenAddress != address(0), "Token address not set");
        // revert duplicate register
        RegisteredToken memory rt = tokens[_tokenId];
        require(!rt.registered, "Token registered");
        require(tokenIds[_tokenAddress] == 0, "Token registered");

        rt.registered = true;
        rt.tokenAddress = _tokenAddress;
        tokens[_tokenId] = rt;
        tokenIds[_tokenAddress] = _tokenId;
        emit NewToken(_tokenId, _tokenAddress);
    }

    /// @notice Add tokens to the list of networks tokens
    /// @param _tokenIdList Token id list
    /// @param _tokenAddressList Token address list
    function addTokens(uint16[] calldata _tokenIdList, address[] calldata _tokenAddressList) external {
        require(_tokenIdList.length == _tokenAddressList.length, "Invalid length");
        for (uint i; i < _tokenIdList.length; i++) {
            addToken(_tokenIdList[i], _tokenAddressList[i]);
        }
    }

    /// @notice Pause token deposits for the given token
    /// @param _tokenId Token id
    /// @param _tokenPaused Token paused status
    function setTokenPaused(uint16 _tokenId, bool _tokenPaused) external onlyGovernor {
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "Token not registered");

        if (rt.paused != _tokenPaused) {
            rt.paused = _tokenPaused;
            tokens[_tokenId] = rt;
            emit TokenPausedUpdate(_tokenId, _tokenPaused);
        }
    }

    /// @notice Change validator status (active or not active)
    /// @param _validator Validator address
    /// @param _active Active flag
    function setValidator(address _validator, bool _active) external onlyGovernor {
        if (validators[_validator] != _active) {
            validators[_validator] = _active;
            emit ValidatorStatusUpdate(_validator, _active);
        }
    }

    /// @notice Checks if validator is active
    /// @param _address Validator address
    function requireActiveValidator(address _address) external view {
        require(validators[_address], "G12");
    }

    /// @notice Get registered token info by id
    function getToken(uint16 _tokenId) external view returns (RegisteredToken memory) {
        return tokens[_tokenId];
    }

    /// @notice Get registered token id by address
    function getTokenId(address _tokenAddress) external view returns (uint16) {
        return tokenIds[_tokenAddress];
    }

    /// @notice Add a new bridge
    /// @param bridge the bridge contract
    function addBridge(address bridge) external onlyGovernor {
        require(bridge != address(0), "Bridge not set");
        // the index of non-exist bridge is zero
        require(bridgeIndex[bridge] == 0, "Bridge exist");

        BridgeInfo memory info = BridgeInfo({
            bridge: bridge,
            enableBridgeTo: true,
            enableBridgeFrom: true
        });
        bridges.push(info);
        bridgeIndex[bridge] = bridges.length;
        emit AddBridge(bridge);
    }

    /// @notice Update bridge info
    /// @dev If we want to remove a bridge(not compromised), we should firstly set `enableBridgeTo` to false
    /// and wait all messages received from this bridge and then set `enableBridgeFrom` to false.
    /// But when a bridge is compromised, we must set both `enableBridgeTo` and `enableBridgeFrom` to false immediately
    /// @param index the bridge info index
    /// @param enableBridgeTo if set to false, bridge to will be disabled
    /// @param enableBridgeFrom if set to false, bridge from will be disabled
    function updateBridge(uint256 index, bool enableBridgeTo, bool enableBridgeFrom) external onlyGovernor {
        require(index < bridges.length, "Invalid bridge index");
        BridgeInfo memory info = bridges[index];
        info.enableBridgeTo = enableBridgeTo;
        info.enableBridgeFrom = enableBridgeFrom;
        bridges[index] = info;
        emit UpdateBridge(index, enableBridgeTo, enableBridgeFrom);
    }

    function isBridgeToEnabled(address bridge) external view override returns (bool) {
        uint256 index = bridgeIndex[bridge] - 1;
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeTo;
    }

    function isBridgeFromEnabled(address bridge) external view override returns (bool) {
        uint256 index = bridgeIndex[bridge] - 1;
        BridgeInfo memory info = bridges[index];
        return info.bridge == bridge && info.enableBridgeFrom;
    }
}
