// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

interface IUSDCBridge {
    /**
   * @dev The usdc address
   */
    function usdc() external view returns (address);

    /**
   * @dev Sends the sender's USDC from L1 to the recipient on L2, locks the USDC sent
   * in this contract and sends a message to the message bridge
   * contract to mint the equivalent USDC on L2
   * @param amount The amount of USDC to send
   * @param to The recipient's address to receive the funds
   */
    function depositTo(uint256 amount, address to) external payable;
}
