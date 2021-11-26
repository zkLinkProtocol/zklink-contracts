// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;
import "./zksync/IERC20.sol";

/// @title Interface of the ZKLink
/// @author zk.link
interface IZkLink {

    /// @notice Add token to l2 cross chain pair
    /// @param _zkLinkAddress Receiver Layer 2 address if add liquidity failed
    /// @param _token Token added
    /// @param _amount Amount of token
    /// @param _pair L2 cross chain pair address
    /// @param _minLpAmount L2 lp token amount min received
    /// @return nft token id
    function addLiquidity(address _zkLinkAddress, IERC20 _token, uint104 _amount, address _pair, uint104 _minLpAmount) external returns (uint32);

    /// @notice Remove liquidity from l1 and get token back from l2 cross chain pair
    /// @param _zkLinkAddress Receiver Layer 2 address if remove liquidity success
    /// @param _nftTokenId Nft token that contains info about the liquidity
    /// @param _minAmount Token amount min received
    function removeLiquidity(address _zkLinkAddress, uint32 _nftTokenId, uint104 _minAmount) external;
}
