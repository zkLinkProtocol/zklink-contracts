// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

interface ILineaERC20Bridge {
    function depositTo(uint256 amount, address to) external;

    function receiveFromOtherLayer(address recipient, uint256 amount) external;
}
