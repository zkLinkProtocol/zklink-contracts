// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.7.0;

import "./ICurve.sol";
import "../IZkLink.sol";

/// @title Convert Curve base pool token to it's LP and then add liquidity to ZkLink
/// @author zk.link
contract CurveBaseRouter {

    ICurve public curve;
    IERC20 public curveLPToken;
    IZkLink public zkLink;

    constructor(address _curve, address _curveLPToken, address _zkLink) {
        curve = ICurve(_curve);
        curveLPToken = IERC20(_curveLPToken);
        zkLink = IZkLink(_zkLink);
    }

    /// @notice Convert token to Curve LP and then add liquidity to l2 cross chain pair
    /// @param _amounts List of amounts of coins to deposit to curve pool
    /// @param _min_mint_amount Minimum amount of Curve LP tokens to mint from the deposit
    /// @param _zkLinkAddress Receiver Layer 2 address if add liquidity to ZkLink failed
    /// @param _pair L2 cross chain pair address
    /// @param _minLpAmount L2 lp token amount min received
    /// @return nft token id
    function addLiquidity(uint256[] memory _amounts, uint256 _min_mint_amount, address _zkLinkAddress, address _pair, uint104 _minLpAmount) external returns (uint32) {
        uint256 curveLPAmount = curve.add_liquidity(_amounts, _min_mint_amount);
        return zkLink.addLiquidity(_zkLinkAddress, curveLPToken, uint104(curveLPAmount), _pair, _minLpAmount);
    }
}
