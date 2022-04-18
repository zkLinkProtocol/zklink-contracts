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

    modifier onlyGovernor {
        require(msg.sender == networkGovernor, "G0");
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
        require(_newGovernor != address(0), "G1");
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
        require(_tokenId > 0 && _tokenId < MAX_AMOUNT_OF_REGISTERED_TOKENS, "G2");
        // token MUST be not zero address
        require(_tokenAddress != address(0), "G3");
        // revert duplicate register
        RegisteredToken memory rt = tokens[_tokenId];
        require(!rt.registered, "G4");
        require(tokenIds[_tokenAddress] == 0, "G5");

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
        require(_tokenIdList.length == _tokenAddressList.length, "G6");
        for (uint i; i < _tokenIdList.length; i++) {
            addToken(_tokenIdList[i], _tokenAddressList[i]);
        }
    }

    /// @notice Pause token deposits for the given token
    /// @param _tokenId Token id
    /// @param _tokenPaused Token paused status
    function setTokenPaused(uint16 _tokenId, bool _tokenPaused) external onlyGovernor {
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "G7");

        if (rt.paused != _tokenPaused) {
            rt.paused = _tokenPaused;
            tokens[_tokenId] = rt;
            emit TokenPausedUpdate(_tokenId, _tokenPaused);
        }
    }

    /// @notice Update token address
    /// @param _tokenId Token id
    /// @param _newTokenAddress Token address to replace
    function setTokenAddress(uint16 _tokenId, address _newTokenAddress) external onlyGovernor {
        // new token address MUST not be zero address or eth address
        require(_newTokenAddress != address(0) && _newTokenAddress != ETH_ADDRESS, "G8");
        // tokenId MUST be registered
        RegisteredToken memory rt = tokens[_tokenId];
        require(rt.registered, "G9");
        // tokenAddress MUST not be registered
        require(tokenIds[_newTokenAddress] == 0, "G10");
        // token represent ETH MUST not be updated
        require(rt.tokenAddress != ETH_ADDRESS, "G11");

        if (rt.tokenAddress != _newTokenAddress) {
            delete tokenIds[rt.tokenAddress];
            rt.tokenAddress = _newTokenAddress;
            tokens[_tokenId] = rt;
            tokenIds[_newTokenAddress] = _tokenId;
            emit TokenAddressUpdate(_tokenId, _newTokenAddress);
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
}
