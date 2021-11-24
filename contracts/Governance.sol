// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./zksync/Config.sol";
import "./nft/IZKLinkNFT.sol";
import "./oracle/ICrtReporter.sol";

/// @title Governance Contract
/// @author Matter Labs
contract Governance is Config {
    /// @notice Token added to Franklin net
    event NewToken(address indexed token, uint16 indexed tokenId, bool mappable);

    /// @notice Governor changed
    event NewGovernor(address newGovernor);

    /// @notice Validator's status changed
    event ValidatorStatusUpdate(address indexed validatorAddress, bool isActive);

    event TokenPausedUpdate(address indexed token, bool paused);

    event TokenMappingUpdate(address indexed token, bool isMapping);

    /// @notice Nft address changed
    event NftUpdate(address indexed nft);

    /// @notice Crt crt reporters changed
    event CrtReporterUpdate(ICrtReporter[] crtReporters);

    /// @notice Crt verified
    event CrtVerified(uint256 indexed crtBlock);

    /// @notice Address which will exercise governance over the network i.e. add tokens, change validator set, conduct upgrades
    address public networkGovernor;

    /// @notice Total number of ERC20 tokens registered in the network (excluding ETH, which is hardcoded as tokenId = 0)
    uint16 public totalTokens;

    /// @notice List of registered tokens by tokenId
    mapping(uint16 => address) public tokenAddresses;

    /// @notice List of registered tokens by address
    mapping(address => uint16) public tokenIds;

    /// @notice List of permitted validators
    mapping(address => bool) public validators;

    /// @notice Paused tokens list, deposits are impossible to create for paused tokens
    mapping(uint16 => bool) public pausedTokens;

    /// @notice Mapping tokens list
    mapping(uint16 => bool) public mappingTokens;

    /// @notice ZKLinkNFT mint to user when add liquidity
    IZKLinkNFT public nft;

    /// @notice Verified crt block height
    uint32 public verifiedCrtBlock;

    /// @notice Crt if verified reporters
    ICrtReporter[] public crtReporters;

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
        require(_newGovernor != address(0), "z0");
        if (networkGovernor != _newGovernor) {
            networkGovernor = _newGovernor;
            emit NewGovernor(_newGovernor);
        }
    }

    /// @notice Add token to the list of networks tokens，token must not be taken fees when transfer
    /// @param _token Token address
    /// @param _mappable Is token mappable
    function addToken(address _token, bool _mappable) external {
        requireGovernor(msg.sender);
        require(tokenIds[_token] == 0, "1e"); // token exists
        require(totalTokens < MAX_AMOUNT_OF_REGISTERED_TOKENS, "1f"); // no free identifiers for tokens

        totalTokens++;
        uint16 newTokenId = totalTokens; // it is not `totalTokens - 1` because tokenId = 0 is reserved for eth

        tokenAddresses[newTokenId] = _token;
        tokenIds[_token] = newTokenId;
        mappingTokens[newTokenId] = _mappable;
        emit NewToken(_token, newTokenId, _mappable);
    }

    /// @notice Pause token deposits for the given token
    /// @param _tokenAddr Token address
    /// @param _tokenPaused Token paused status
    function setTokenPaused(address _tokenAddr, bool _tokenPaused) external {
        requireGovernor(msg.sender);

        uint16 tokenId = this.validateTokenAddress(_tokenAddr);
        if (pausedTokens[tokenId] != _tokenPaused) {
            pausedTokens[tokenId] = _tokenPaused;
            emit TokenPausedUpdate(_tokenAddr, _tokenPaused);
        }
    }

    /// @notice Set token mapping
    /// @param _tokenAddr Token address
    /// @param _tokenMapping Token mapping status
    function setTokenMapping(address _tokenAddr, bool _tokenMapping) external {
        requireGovernor(msg.sender);

        uint16 tokenId = this.validateTokenAddress(_tokenAddr);
        if (mappingTokens[tokenId] != _tokenMapping) {
            mappingTokens[tokenId] = _tokenMapping;
            emit TokenMappingUpdate(_tokenAddr, _tokenMapping);
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

    /// @notice Change nft
    /// @param _newNft ZKLinkNFT address
    function changeNft(address _newNft) external {
        requireGovernor(msg.sender);
        require(_newNft != address(0), "Governance: zero nft address");

        if (_newNft != address(nft)) {
            nft = IZKLinkNFT(_newNft);
            emit NftUpdate(_newNft);
        }
    }

    /// @notice Change crt reporters
    /// @param _newCrtReporters Crt reporters
    function changeCrtReporters(ICrtReporter[] memory _newCrtReporters) external {
        requireGovernor(msg.sender);
        require(_newCrtReporters.length > 1, "Governance: no crt reporter");

        crtReporters = _newCrtReporters;
        emit CrtReporterUpdate(_newCrtReporters);
    }

    /// @notice Check if specified address is is governor
    /// @param _address Address to check
    function requireGovernor(address _address) public view {
        require(_address == networkGovernor, "1g"); // only by governor
    }

    /// @notice Checks if validator is active
    /// @param _address Validator address
    function requireActiveValidator(address _address) external view {
        require(validators[_address], "1h"); // validator is not active
    }

    /// @notice Validate token id (must be less than or equal to total tokens amount)
    /// @param _tokenId Token id
    /// @return bool flag that indicates if token id is less than or equal to total tokens amount
    function isValidTokenId(uint16 _tokenId) external view returns (bool) {
        return _tokenId <= totalTokens;
    }

    /// @notice Validate token address
    /// @param _tokenAddr Token address
    /// @return tokens id
    function validateTokenAddress(address _tokenAddr) external view returns (uint16) {
        uint16 tokenId = tokenIds[_tokenAddr];
        require(tokenId != 0, "1i"); // 0 is not a valid token
        return tokenId;
    }

    /// @notice Update verified crt block
    function updateVerifiedCrtBlock(uint32 crtBlock) external {
        require(crtBlock > verifiedCrtBlock, 'Governance: crtBlock');

        // every reporter of any chain should report the same verify result of target block number
        for (uint256 i = 0; i < crtReporters.length; i++) {
            require(crtReporters[i].isCrtVerified(crtBlock), 'Governance: crt not verify');
        }
        verifiedCrtBlock = crtBlock;
        emit CrtVerified(verifiedCrtBlock);
    }
}
