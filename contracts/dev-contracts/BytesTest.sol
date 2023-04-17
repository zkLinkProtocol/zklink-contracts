// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../zksync/Bytes.sol";

contract BytesTest {
    function read(
        bytes calldata _data,
        uint256 _offset,
        uint256 _len
    ) external pure returns (uint256 new_offset, bytes memory data) {
        return Bytes.read(_data, _offset, _len);
    }

    function testUInt24(bytes calldata buf) external pure returns (uint24 r, uint256 offset) {
        (offset, r) = Bytes.readUInt24(buf, 0);
    }
}
