// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

import "./zksync/Config.sol";

/// @title Governance Contract
/// @author zk.link
contract Governance is Config {
    /// @notice Token added to ZkLink net
    event NewToken(uint16 indexed tokenId, address indexed token);

    /// @notice Governor changed
    event NewGovernor(address newGovernor);

    /// @notice Validator's status changed
    event ValidatorStatusUpdate(address indexed validatorAddress, bool isActive);

    /// @notice Token pause status update
    event TokenPausedUpdate(uint16 indexed token, bool paused);

    /// @notice Token address update
    event TokenAddressUpdate(uint16 indexed token, address newAddress);

    /// @notice Address which will exercise governance over the network i.e. add tokens, change validator set, conduct upgrades
    address public networkGovernor;

    /// @notice List of permitted validators
    mapping(address => bool) public validators;

    struct RegisteredToken {
        bool registered; // whether token registered to ZkLink or not, default is false
        bool paused; // whether token can deposit to ZkLink or not, default is false
        address tokenAddress; // the token address, zero represents eth, can be updated
    }

    /// @notice A map of registered token infos
    mapping(uint16 => RegisteredToken) public tokens;

    /// @notice A map of token address to id, 0 is invalid token id
    mapping(address => uint16) public tokenIds;

    /// @notice Governance contract initialization. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param initializationParameters Encoded representation of initialization parameters:
    ///     _networkGovernor The address of network governor
    function initialize(bytes calldata initializationParameters) external {
        address _networkGovernor = abi.decode(initializationParameters, (address));

        networkGovernor = _networkGovernor;
    }

    /// @notice Governance contract upgrade. Can be external because Proxy contract intercepts illegal calls of this function.
    /// @param upgradeParameters Encoded representation of upgrade parameters
    function upgrade(bytes calldata upgradeParameters) external {}

    /// @notice Change current governor
    /// @param _newGovernor Address of the new governor
    function changeGovernor(address _newGovernor) external {
        requireGovernor(msg.sender);
        require(_newGovernor != address(0), "Gov: address not set");
        if (networkGovernor != _newGovernor) {
            networkGovernor = _newGovernor;
            emit NewGovernor(_newGovernor);
        }
    }

    /// @notice Add token to the list of networks tokens
    /// @param _tokenId Token id
    /// @param _tokenAddress Token address, zero represent ETH
    function addToken(uint16 _tokenId, address _tokenAddress) public {
        requireGovernor(msg.sender);
        // token id MUST be in a valid range
        require(_tokenId > 0 && _tokenId < MAX_AMOUNT_OF_REGISTERED_TOKENS, "Gov: invalid tokenId");
        RegisteredToken memory rt = tokens[_tokenId];
        require(!rt.registered, "Gov: token registered");

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
        require(_tokenIdList.length == _tokenAddressList.length, "Gov: invalid array length");
        for (uint i; i < _tokenIdList.length; i++) {
            addToken(_tokenIdList[i], _tokenAddressList[i]);
        }
    }

    /// @notice Pause token deposits for the given token
    /// @param _tokenId Token id
    /// @param _tokenPaused Token paused status
    function setTokenPaused(uint16 _tokenId, bool _tokenPaused) external {
        requireGovernor(msg.sender);
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "Gov: token not registered");

        if (rt.paused != _tokenPaused) {
            rt.paused = _tokenPaused;
            emit TokenPausedUpdate(_tokenId, _tokenPaused);
        }
    }

    /// @notice Update token address
    /// @param _tokenId Token id
    /// @param _newTokenAddress Token address to replace
    function setTokenAddress(uint16 _tokenId, address _newTokenAddress) external {
        requireGovernor(msg.sender);
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "Gov: token not registered");
        // ETH address MUST not be updated
        require(rt.tokenAddress != ETH_ADDRESS, "Gov: eth address update disabled");
        // new token address MUST not be zero address
        require(_newTokenAddress != address(0), "Gov: newTokenAddress not set");

        if (rt.tokenAddress != _newTokenAddress) {
            delete tokenIds[rt.tokenAddress];
            rt.tokenAddress = _newTokenAddress;
            tokenIds[_newTokenAddress] = _tokenId;
            emit TokenAddressUpdate(_tokenId, _newTokenAddress);
        }
    }

    /// @notice Change validator status (active or not active)
    /// @param _validator Validator address
    /// @param _active Active flag
    function setValidator(address _validator, bool _active) external {
        requireGovernor(msg.sender);
        if (validators[_validator] != _active) {
            validators[_validator] = _active;
            emit ValidatorStatusUpdate(_validator, _active);
        }
    }

    /// @notice Check if specified address is is governor
    /// @param _address Address to check
    function requireGovernor(address _address) public view {
        require(_address == networkGovernor, "Gov: no auth");
    }

    /// @notice Checks if validator is active
    /// @param _address Validator address
    function requireActiveValidator(address _address) external view {
        require(validators[_address], "Gov: not validator");
    }

    /// @notice Get registered token info by id
    function getToken(uint16 _tokenId) external view returns (RegisteredToken memory) {
        return tokens[_tokenId];
    }

    /// @notice Get registered token id by address
    function getTokenId(address _tokenAddress) external view returns (uint16) {
        return tokenIds[_tokenAddress];
    }
}
