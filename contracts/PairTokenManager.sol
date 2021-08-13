// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

contract PairTokenManager {
    // This is computed by: 2048 - 128 = 1920
    uint16 constant MAX_AMOUNT_OF_PAIR_TOKENS = 1920;

    // 0 is eth, 1-127 is erc20 token id
    uint16 constant PAIR_TOKEN_START_ID = $(MAX_AMOUNT_OF_REGISTERED_TOKENS) + 1;

    /// @notice Total number of pair tokens registered in the network
    uint16 public totalPairTokens;

    /// @notice List of registered tokens by tokenId
    mapping(uint16 => address) public tokenAddresses;

    /// @notice List of registered tokens by address
    mapping(address => uint16) public tokenIds;

    /// @notice Token added to Franklin net
    event NewToken(
        address indexed token,
        uint16 indexed tokenId
    );

    /// @notice Add pair token
    /// @param _token Token address
    function addPairToken(address _token) internal {
        require(tokenIds[_token] == 0, "pan1"); // token exists
        require(totalPairTokens < MAX_AMOUNT_OF_PAIR_TOKENS, "pan2"); // no free identifiers for tokens

        uint16 newPairTokenId = PAIR_TOKEN_START_ID + totalPairTokens;
        totalPairTokens++;

        tokenAddresses[newPairTokenId] = _token;
        tokenIds[_token] = newPairTokenId;
        emit NewToken(_token, newPairTokenId);
    }

    /// @notice Validate pair token address
    /// @param _tokenAddr Token address
    /// @return tokens id
    function validatePairTokenAddress(address _tokenAddr) public view returns (uint16) {
        uint16 tokenId = tokenIds[_tokenAddr];
        require(tokenId != 0, "pms3");
        require(tokenId < (PAIR_TOKEN_START_ID + MAX_AMOUNT_OF_PAIR_TOKENS), "pms4");
        return tokenId;
    }
}
