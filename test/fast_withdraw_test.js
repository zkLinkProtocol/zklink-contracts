const { expect } = require('chai');
const { deploy, calAcceptHash, extendAddress} = require('./utils');
const {parseEther} = require("ethers/lib/utils");
const {BigNumber} = require("ethers");

describe('Fast withdraw unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, token2, token2Id, defaultSender, alice, bob;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
    });

    it('normal withdraw erc20 token should success', async () => {
        const chainId = 1;
        const accountId = 1;
        const subAccountId = 1;
        const tokenId = token2Id;
        const amount = parseEther("10");
        const fee = 0;
        const owner = bob.address;
        const nonce = 0;
        const fastWithdrawFeeRate = 50;

        const op = {
            "chainId": chainId,
            "accountId":accountId,
            "subAccountId":subAccountId,
            "tokenId":tokenId,
            "amount":amount,
            "fee":fee,
            "owner":owner,
            "nonce":nonce,
            "fastWithdrawFeeRate":fastWithdrawFeeRate
        }

        await token2.mintTo(zkLink.address, amount);

        const b0 = await token2.balanceOf(owner);
        await zkLink.testExecuteWithdraw(op);
        const b1 = await token2.balanceOf(owner);
        expect(b1.sub(b0)).to.eq(amount);
    });

    it('fast withdraw and accept finish, token should be sent to accepter', async () => {
        const chainId = 1;
        const accountId = 1;
        const subAccountId = 1;
        const tokenId = token2Id;
        const amount = parseEther("10");
        const fee = 0;
        const owner = alice.address;
        const nonce = 1;
        const fastWithdrawFeeRate = 50;
        const MAX_WITHDRAW_FEE_RATE = 10000;

        const bobBalance0 = await token2.balanceOf(bob.address);
        const bobPendingBalance0 = await periphery.getPendingBalance(extendAddress(bob.address), token2Id);
        const aliceBalance0 = await token2.balanceOf(alice.address);

        await token2.mintTo(bob.address, amount);
        const amountTransfer = amount.mul(BigNumber.from(MAX_WITHDRAW_FEE_RATE-fastWithdrawFeeRate)).div(BigNumber.from(MAX_WITHDRAW_FEE_RATE));
        await token2.connect(bob).approve(periphery.address, amountTransfer);
        await periphery.connect(bob).acceptERC20(bob.address, accountId, owner, tokenId, amount, fastWithdrawFeeRate, nonce, amountTransfer);

        const op = {
            "chainId": chainId,
            "accountId":accountId,
            "subAccountId":subAccountId,
            "tokenId":tokenId,
            "amount":amount,
            "fee":fee,
            "owner":owner,
            "nonce":nonce,
            "fastWithdrawFeeRate":fastWithdrawFeeRate
        }

        await token2.mintTo(zkLink.address, amount);

        await zkLink.testExecuteWithdraw(op);

        const aliceBalance1 = await token2.balanceOf(alice.address);
        const bobBalance1 = await token2.balanceOf(bob.address);
        const bobPendingBalance1 = await periphery.getPendingBalance(extendAddress(bob.address), token2Id);
        expect(aliceBalance1.sub(aliceBalance0)).to.eq(amountTransfer);
        expect(bobBalance1.sub(bobBalance0)).to.eq(amount.sub(amountTransfer)); // amount - amountTransfer is the profit of accept
        expect(bobPendingBalance1.sub(bobPendingBalance0)).to.eq(amount); // accepter pending balance increase
    });

    it('fast withdraw but accept not finish, token should be sent to owner as normal', async () => {
        const chainId = 1;
        const accountId = 1;
        const subAccountId = 1;
        const tokenId = token2Id;
        const amount = parseEther("10");
        const fee = 0;
        const owner = alice.address;
        const nonce = 2;
        const fastWithdrawFeeRate = 50;

        const aliceBalance0 = await token2.balanceOf(alice.address);

        const op = {
            "chainId": chainId,
            "accountId":accountId,
            "subAccountId":subAccountId,
            "tokenId":tokenId,
            "amount":amount,
            "fee":fee,
            "owner":owner,
            "nonce":nonce,
            "fastWithdrawFeeRate":fastWithdrawFeeRate
        }

        await token2.mintTo(zkLink.address, amount);

        await zkLink.testExecuteWithdraw(op);
        const aliceBalance1 = await token2.balanceOf(alice.address);
        expect(aliceBalance1.sub(aliceBalance0)).to.eq(amount);
        const hash = calAcceptHash(owner, tokenId, amount, fastWithdrawFeeRate, nonce);
        expect(await periphery.getAccepter(accountId, hash)).to.eq(owner);
    });
});
