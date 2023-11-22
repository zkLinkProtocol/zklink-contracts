const { expect } = require('chai');
const { deploy, CHAIN_ID} = require('./utils');
const { writeDepositPubdata, extendAddress} = require('../script/op_utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink withdraw pending balance unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, ethId, token2, token2Id, defaultSender, alice;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
    });

    it('invalid state or params should be failed when withdraw pending balance', async () => {
        // token not registered
        await expect(periphery.connect(defaultSender).withdrawPendingBalance(defaultSender.address, 100, parseEther("1"))).to.be.revertedWith("b0");

        // zero amount
        await expect(periphery.connect(defaultSender).withdrawPendingBalance(defaultSender.address, ethId, 0)).to.be.revertedWith("b1");

        // no pending balance
        await expect(periphery.connect(defaultSender).withdrawPendingBalance(defaultSender.address, ethId, parseEther("1"))).to.be.revertedWith("b1");
    });

    it('withdraw pending eth balance should success', async () => {
        // increase pending balance
        const depositAmount = parseEther("1.0");
        await zkLink.connect(defaultSender).depositETH(extendAddress(alice.address), 0, {value: depositAmount});
        const pubdata = writeDepositPubdata({ chainId:CHAIN_ID, subAccountId:0, tokenId:ethId, targetTokenId:ethId, amount:depositAmount, owner:extendAddress(alice.address) });
        await zkLink.setExodus(true);
        await periphery.cancelOutstandingDepositsForExodusMode(1, [pubdata]);
        await zkLink.setExodus(false);
        expect(await periphery.getPendingBalance(extendAddress(alice.address), ethId)).to.be.eq(depositAmount);

        const b0 = await alice.getBalance();
        const amount0 = parseEther("0.5");
        await expect(periphery.withdrawPendingBalance(alice.address, ethId, amount0)).to.be
            .emit(periphery, "Withdrawal")
            .withArgs(ethId, amount0);
        expect(await alice.getBalance()).to.be.eq(b0.add(amount0));
        expect(await periphery.getPendingBalance(extendAddress(alice.address), ethId)).to.be.eq(depositAmount.sub(amount0));

        const leftAmount = depositAmount.sub(amount0);
        const amount1 = parseEther("0.6");
        await expect(periphery.withdrawPendingBalance(alice.address, ethId, amount1)).to.be
            .emit(periphery, "Withdrawal")
            .withArgs(ethId, leftAmount);
        expect(await alice.getBalance()).to.be.eq(b0.add(depositAmount));
        expect(await periphery.getPendingBalance(extendAddress(alice.address), ethId)).to.be.eq(0);
    });

    it('withdraw pending standard erc20 token balance should success', async () => {
        // increase pending balance
        const depositAmount = parseEther("1.0");
        await token2.connect(defaultSender).mint(depositAmount);
        await token2.connect(defaultSender).approve(zkLink.address, depositAmount);
        await zkLink.connect(defaultSender).depositERC20(token2.address, depositAmount, extendAddress(alice.address), 0, false);
        const pubdata = writeDepositPubdata({ chainId:CHAIN_ID, subAccountId:0, tokenId:token2Id, targetTokenId:token2Id, amount:depositAmount, owner:extendAddress(alice.address) });
        await zkLink.setExodus(true);
        await periphery.cancelOutstandingDepositsForExodusMode(1, [pubdata]);
        await zkLink.setExodus(false);
        expect(await periphery.getPendingBalance(extendAddress(alice.address), token2Id)).to.be.eq(depositAmount);

        const b0 = await token2.balanceOf(alice.address);
        const amount0 = parseEther("0.5");
        await expect(periphery.withdrawPendingBalance(alice.address, token2Id, amount0)).to.be
            .emit(periphery, "Withdrawal")
            .withArgs(token2Id, amount0);
        expect(await token2.balanceOf(alice.address)).to.be.eq(b0.add(amount0));
        expect(await periphery.getPendingBalance(extendAddress(alice.address), token2Id)).to.be.eq(depositAmount.sub(amount0));

        const leftAmount = depositAmount.sub(amount0);
        const amount1 = parseEther("0.6");
        await expect(periphery.withdrawPendingBalance(alice.address, token2Id, amount1)).to.be
            .emit(periphery, "Withdrawal")
            .withArgs(token2Id, leftAmount);
        expect(await token2.balanceOf(alice.address)).to.be.eq(b0.add(depositAmount));
        expect(await periphery.getPendingBalance(extendAddress(alice.address), token2Id)).to.be.eq(0);
    });
});
