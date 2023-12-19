// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import '../interfaces/IZkLink.sol';

contract MultiCall {
    struct WithdrawToL1Info {
        address owner;
        address token;
        uint128 amount;
        uint16 fastWithdrawFeeRate;
        uint32 accountIdOfNonce;
        uint8 subAccountIdOfNonce;
        uint32 nonce;
        uint256 value;
    }

    struct WithdrawPendingBalanceInfo {
        address payable owner;
        uint16 tokenId;
        uint128 amount;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    event Call(address target, bytes _calldata, bool success, bytes result);

    function multiStaticCall(
        address[] calldata targets,
        bytes[] calldata calls
    ) external view returns (uint256 blockNumber, Result[] memory returnData) {
        blockNumber = block.number;
        returnData = new Result[](calls.length);
        for (uint i = 0; i < targets.length; i++) {
            (bool success, bytes memory ret) = targets[i].staticcall(calls[i]);
            returnData[i] = Result(success, ret);
        }
    }

    function strictMulticall(
        address[] calldata targets,
        bytes[] calldata calls
    ) external {
        require(targets.length == calls.length, 'targets.length != calls.length');

        for (uint i = 0; i < targets.length; i++) {
            (bool success, bytes memory data) = targets[i].call(calls[i]);
            require(success, string(data));
        }
    }

    function multicall(
        address[] calldata targets,
        bytes[] calldata calls
    ) external {
        require(targets.length == calls.length, 'targets.length != calls.length');

        for (uint i = 0; i < targets.length; i++) {
            (bool success, bytes memory data) = targets[i].call(calls[i]);
            emit Call(targets[i], calls[i], success, data);
        }
    }

    function batchWithdrawToL1(
        IZkLink zkLinkInstance,
        WithdrawToL1Info[] calldata _withdrawData
    ) external payable {
        for (uint i; i < _withdrawData.length; i++) {
            WithdrawToL1Info memory withdrawInfo = _withdrawData[i];
            zkLinkInstance.withdrawToL1{value: withdrawInfo.value}(
                withdrawInfo.owner,
                withdrawInfo.token,
                withdrawInfo.amount,
                withdrawInfo.fastWithdrawFeeRate,
                withdrawInfo.accountIdOfNonce,
                withdrawInfo.subAccountIdOfNonce,
                withdrawInfo.nonce
            );
        }
    }

    function batchWithdrawPendingBalance(
        IZkLink zkLinkInstance,
        WithdrawPendingBalanceInfo[] calldata _withdrawData
    ) external {
        for (uint i; i < _withdrawData.length; i++) {
            WithdrawPendingBalanceInfo memory withdrawInfo = _withdrawData[i];
            zkLinkInstance.withdrawPendingBalance(
                withdrawInfo.owner,
                withdrawInfo.tokenId,
                withdrawInfo.amount
            );
        }
    }
}
