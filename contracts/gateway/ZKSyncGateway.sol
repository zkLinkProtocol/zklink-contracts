// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/IZkLink.sol";
import "../interfaces/IZKSyncGateway.sol";

import "../library/AddressAliasHelper.sol";

contract ZKSyncL2Gateway is Ownable, IZKSyncGateway {
    /// @notice zklink contract address of zksync
    IZkLink public zklink;

    /// @notice L1 gateway address
    address public remoteGateway;

    modifier onlyRemoteGateway() {
        if (AddressAliasHelper.undoL1ToL2Alias(msg.sender) != remoteGateway) {
            revert OnlyRemoteGateway();
        }
        _;
    }

    constructor(IZkLink _zklink, address _remoteGateway) {
        zklink = _zklink;
        remoteGateway = _remoteGateway;
    }

    /// deposit ETH to zklink
    /// @param zkLinkAddress zklink address
    /// @param subAccountId sub account id
    function depositETH(
        bytes32 zkLinkAddress,
        uint8 subAccountId
    ) external payable onlyRemoteGateway {
        zklink.depositETH{value: msg.value}(zkLinkAddress, subAccountId);
        emit DepositETH(msg.sender, zkLinkAddress, subAccountId, msg.value);
    }

    /// deposit ERC20 token to zklink
    /// @param _token L2 token address
    /// @param _amount amount to deposit
    /// @param _zkLinkAddress zklink address
    /// @param _subAccountId sub account id
    /// @param _mapping is mapping token
    function depositERC20(
        address _token,
        uint104 _amount,
        bytes32 _zkLinkAddress,
        uint8 _subAccountId,
        bool _mapping
    ) external payable onlyRemoteGateway {
        IERC20(_token).approve(address(zklink), _amount);

        zklink.depositERC20(
            IERC20(_token),
            _amount,
            _zkLinkAddress,
            _subAccountId,
            _mapping
        );

        emit DepositERC20(
            _token,
            _amount,
            _zkLinkAddress,
            _subAccountId,
            _mapping
        );
    }

    /// set zklink contract address
    /// @param _zklink zklink address
    function setZKLink(IZkLink _zklink) external {
        if (address(zklink) == address(0)) {
            revert InvalidParmas();
        }
        zklink = _zklink;
    }

    /// set remote gateway address
    /// @param _remoteGateway L1 gateway contract address
    function setRemoteGateway(address _remoteGateway) external {
        if (_remoteGateway == address(0)) {
            revert InvalidParmas();
        }
        remoteGateway = _remoteGateway;
    }
}
