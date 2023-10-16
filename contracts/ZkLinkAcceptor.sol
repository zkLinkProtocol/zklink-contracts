// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZkLink acceptor contract
/// @author zk.link
abstract contract ZkLinkAcceptor {
    using SafeERC20 for IERC20;

    /// @dev Address represent eth when deposit or withdraw
    address internal constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev When set fee = 100, it means 1%
    uint16 internal constant MAX_ACCEPT_FEE_RATE = 10000;

    /// @dev Accept infos of withdraw
    /// @dev key is keccak256(abi.encodePacked(accountIdOfNonce, subAccountIdOfNonce, nonce, owner, token, amount, fastWithdrawFeeRate))
    /// @dev value is the acceptor
    mapping(bytes32 => address) public accepts;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;

    /// @notice Event emitted when acceptor accept a fast withdraw
    event Accept(address acceptor, address receiver, address token, uint128 amount, uint16 withdrawFeeRate, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce, uint128 amountReceive);

    /// @notice Acceptor accept a eth fast withdraw, acceptor will get a fee for profit
    /// @param receiver User receive token from acceptor (the owner of withdraw operation)
    /// @param amount The amount of withdraw operation
    /// @param fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    /// @param accountIdOfNonce Account that supply nonce
    /// @param subAccountIdOfNonce SubAccount that supply nonce
    /// @param nonce SubAccount nonce, used to produce unique accept info
    function acceptETH(address payable receiver, uint128 amount, uint16 fastWithdrawFeeRate, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce) external payable {
        // ===Checks===
        uint128 amountReceive = _checkAccept(msg.sender, receiver, ETH_ADDRESS, amount, fastWithdrawFeeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);

        // ===Interactions===
        // make sure msg value >= amountReceive
        uint256 amountReturn = msg.value - amountReceive;
        // msg.sender should set a reasonable gas limit when call this function
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{value: amountReceive}("");
        require(success, "E0");
        // if send too more eth then return back to msg sender
        if (amountReturn > 0) {
            // it's safe to use call to msg.sender and can send all gas left to it
            // solhint-disable-next-line avoid-low-level-calls
            (success, ) = msg.sender.call{value: amountReturn}("");
            require(success, "E1");
        }
        emit Accept(msg.sender, receiver, ETH_ADDRESS, amount, fastWithdrawFeeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive);
    }

    /// @notice Acceptor accept a erc20 token fast withdraw, acceptor will get a fee for profit
    /// @param receiver User receive token from acceptor (the owner of withdraw operation)
    /// @param token Token address
    /// @param amount The amount of withdraw operation
    /// @param fastWithdrawFeeRate Fast withdraw fee rate taken by acceptor
    /// @param accountIdOfNonce Account that supply nonce
    /// @param subAccountIdOfNonce SubAccount that supply nonce
    /// @param nonce SubAccount nonce, used to produce unique accept info
    function acceptERC20(address receiver, address token, uint128 amount, uint16 fastWithdrawFeeRate, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce) external {
        // ===Checks===
        uint128 amountReceive = _checkAccept(msg.sender, receiver, token, amount, fastWithdrawFeeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);

        // ===Interactions===
        IERC20(token).safeTransferFrom(msg.sender, receiver, amountReceive);
        emit Accept(msg.sender, receiver, token, amount, fastWithdrawFeeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive);
    }

    function _checkAccept(address acceptor, address receiver, address token, uint128 amount, uint16 fastWithdrawFeeRate, uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce) internal returns (uint128 amountReceive) {
        // acceptor and receiver MUST be set and MUST not be the same
        require(receiver != address(0), "H1");
        require(receiver != acceptor, "H2");
        // feeRate MUST be valid and MUST not be 100%
        require(fastWithdrawFeeRate < MAX_ACCEPT_FEE_RATE, "H3");
        amountReceive = amount * (MAX_ACCEPT_FEE_RATE - fastWithdrawFeeRate) / MAX_ACCEPT_FEE_RATE;

        // accept tx may be later than block exec tx(with user withdraw op)
        bytes32 hash = getWithdrawHash(accountIdOfNonce, subAccountIdOfNonce, nonce, receiver, token, amount, fastWithdrawFeeRate);
        require(accepts[hash] == address(0), "H4");

        // ===Effects===
        accepts[hash] = acceptor;
    }

    /// @dev Return accept record hash for withdraw
    /// @dev (accountIdOfNonce, subAccountIdOfNonce, nonce) ensures the uniqueness of withdraw hash
    function getWithdrawHash(uint32 accountIdOfNonce, uint8 subAccountIdOfNonce, uint32 nonce, address owner, address token, uint128 amount, uint16 fastWithdrawFeeRate) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(accountIdOfNonce, subAccountIdOfNonce, nonce, owner, token, amount, fastWithdrawFeeRate));
    }
}
