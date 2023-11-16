const { expect } = require('chai');
const { deploy, ETH_ADDRESS} = require('./utils');
const { calWithdrawHash } = require('../script/op_utils');
const {parseEther, parseUnits} = require("ethers/lib/utils");
const {ethers} = require("hardhat");

describe('Withdraw to L1 unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, ethId, token2, token2Id, token5, token5Id, governor, defaultSender, alice, bob, gateway;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token5 = deployedInfo.token5.contract;
        token5Id = deployedInfo.token5.tokenId;
        governor = deployedInfo.governor;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
        gateway = deployedInfo.gateway;
        // set gateway
        await periphery.connect(governor).setGateway(gateway.address);
    });

    it('withdraw eth to l1 should success', async () => {
        const chainId = 1;
        const owner = alice.address;
        const tokenId = ethId;
        const token = ETH_ADDRESS;
        const l2Amount = parseEther("10"); // 10000000000000000000
        const l1Amount = l2Amount;
        const fee = 0;
        const fastWithdrawFeeRate = 50;
        const accountId = 1;
        const subAccountId = 1;
        const nonce = 1;
        const gatewayFee = parseEther("0.001");

        // zkLink init balance is 30 eth
        await bob.sendTransaction({
            to: periphery.address,
            value: parseEther("30")
        });

        const zkLinkBalance0 = await ethers.provider.getBalance(periphery.address);
        const gatewayBalance0 = await ethers.provider.getBalance(gateway.address);

        // no withdraw exist
        await expect(periphery.connect(bob).withdrawToL1(owner,token,l1Amount,fastWithdrawFeeRate,accountId,subAccountId,nonce, {value: gatewayFee}))
            .to.be.revertedWith("M0");

        // execute withdraw
        const op = {
            "chainId": chainId,
            "accountId":accountId,
            "subAccountId":subAccountId,
            "tokenId":tokenId,
            "amount":l2Amount,
            "fee":fee,
            "owner":owner,
            "nonce":nonce,
            "fastWithdrawFeeRate":fastWithdrawFeeRate,
            "withdrawToL1":1
        }
        const withdrawHash = calWithdrawHash(owner,token,l1Amount,fastWithdrawFeeRate,accountId,subAccountId,nonce);
        await expect(await zkLink.testExecuteWithdraw(op))
            .to.be.emit(zkLink, "WithdrawalPendingL1")
            .withArgs(withdrawHash);
        await expect(periphery.connect(bob).withdrawToL1(owner,token,l1Amount,fastWithdrawFeeRate,accountId,subAccountId,nonce, {value: gatewayFee}))
            .to.be.emit(periphery, "WithdrawalL1")
            .withArgs(withdrawHash);
        // withdraw data executed
        expect(await periphery.pendingL1Withdraws(withdrawHash)).to.eq(false);

        const zkLinkBalance1 = await ethers.provider.getBalance(periphery.address);
        const gatewayBalance1 = await ethers.provider.getBalance(gateway.address);

        // zkLink balance reduced by l1Amount
        expect(zkLinkBalance0.sub(zkLinkBalance1)).to.eq(l1Amount);
        // gateway balance increased by l1Amount + fee
        expect(gatewayBalance1.sub(gatewayBalance0)).to.eq(l1Amount.add(gatewayFee));
    });

    it('withdraw erc20 to l1 should success', async () => {
        const chainId = 1;
        const owner = alice.address;
        const tokenId = token5Id;
        const token = token5;
        const l2Amount = parseEther("10.123456"); // 10123456000000000000
        const l1Amount = parseUnits("10.123456", 6); // 10123456
        const fee = 0;
        const fastWithdrawFeeRate = 50;
        const accountId = 1;
        const subAccountId = 1;
        const nonce = 2;
        const gatewayFee = parseEther("0.001");

        // zkLink init balance is 30
        await token.mintTo(periphery.address, parseUnits("30", 6));

        const zkLinkBalance0 = await token.balanceOf(periphery.address);
        const gatewayBalance0 = await token.balanceOf(gateway.address);
        const zkLinkEthBalance0 = await ethers.provider.getBalance(periphery.address);
        const gatewayEthBalance0 = await ethers.provider.getBalance(gateway.address);

        // execute withdraw
        const op = {
            "chainId": chainId,
            "accountId":accountId,
            "subAccountId":subAccountId,
            "tokenId":tokenId,
            "amount":l2Amount,
            "fee":fee,
            "owner":owner,
            "nonce":nonce,
            "fastWithdrawFeeRate":fastWithdrawFeeRate,
            "withdrawToL1":1
        }
        const withdrawHash = calWithdrawHash(owner,token.address,l1Amount,fastWithdrawFeeRate,accountId,subAccountId,nonce);
        await expect(await zkLink.testExecuteWithdraw(op))
            .to.be.emit(zkLink, "WithdrawalPendingL1")
            .withArgs(withdrawHash);
        await expect(periphery.connect(bob).withdrawToL1(owner,token.address,l1Amount,fastWithdrawFeeRate,accountId,subAccountId,nonce, {value: gatewayFee}))
            .to.be.emit(periphery, "WithdrawalL1")
            .withArgs(withdrawHash);
        // withdraw data executed
        expect(await periphery.pendingL1Withdraws(withdrawHash)).to.eq(false);

        const zkLinkBalance1 = await token.balanceOf(periphery.address);
        const gatewayBalance1 = await token.balanceOf(gateway.address);
        const zkLinkEthBalance1 = await ethers.provider.getBalance(periphery.address);
        const gatewayEthBalance1 = await ethers.provider.getBalance(gateway.address);

        // zkLink token balance reduced by l1Amount
        expect(zkLinkBalance0.sub(zkLinkBalance1)).to.eq(l1Amount);
        // gateway token balance increased by l1Amount
        expect(gatewayBalance1.sub(gatewayBalance0)).to.eq(l1Amount);
        // zkLink eth balance not change
        expect(zkLinkEthBalance0).to.eq(zkLinkEthBalance1);
        // gateway eth balance increased by fee
        expect(gatewayEthBalance1.sub(gatewayEthBalance0)).to.eq(gatewayFee);
    });
});
