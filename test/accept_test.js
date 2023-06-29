const { ethers } = require('hardhat');
const { expect } = require('chai');
const { deploy } = require('./utils');
const { calAcceptHash } = require('../script/op_utils');
const {parseEther, keccak256, solidityPack} = require("ethers/lib/utils");

describe('Accept unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, ethId, token2, token2Id, token3, token3Id, defaultSender, alice, bob;
    const fwAId = 1; // the account id of request fast withdraw
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
    });

    it('broker approve should success', async () => {
        await expect(periphery.connect(alice).brokerApprove(token2Id, bob.address, 100))
            .to.be.emit(periphery, "BrokerApprove")
            .withArgs(token2Id, alice.address, bob.address, 100);
        expect(await periphery.connect(alice).brokerAllowance(token2Id, alice.address, bob.address)).to.eq(100);
    });


    it('invalid state or params should failed when accept', async () => {
        await expect(periphery.connect(alice).acceptETH(ethers.constants.AddressZero, fwAId, bob.address, 100, 20, 10, 0, 1))
            .to.be.revertedWith("H0");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, ethers.constants.AddressZero, 100, 20, 10, 0, 1))
            .to.be.revertedWith("H1");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, alice.address, 100, 20, 10, 0, 1))
            .to.be.revertedWith("H2");
        await expect(periphery.connect(alice).acceptERC20(alice.address, fwAId, bob.address, 10000, 100, 20, 1, 10, 0, 100))
            .to.be.revertedWith("H3");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, 100, 10000, 10, 0, 1))
            .to.be.revertedWith("H4");

        const hash = calAcceptHash(bob.address, ethId, 100, 100, 10, 0, 1);
        await periphery.setAcceptor(fwAId, hash, alice.address);
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, 100, 100, 10, 0, 1))
            .to.be.revertedWith("H6");

        await zkLink.setExodus(true);
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, 10000, 100, 10, 0, 1))
            .to.be.revertedWith("0");
        await zkLink.setExodus(false);
    });

    it('accept eth should success', async () => {
        const amount = parseEther("1");
        const feeRate = 100; // 1%
        let accountIdOfNonce = 10;
        let subAccountIdOfNonce = 0;
        let nonce = 1;
        const amountReceive = parseEther("0.99");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountReceive}))
            .to.be.emit(periphery, "Accept")
            .withArgs(alice.address, fwAId, bob.address, ethId, amountReceive, amountReceive);
        let hash = calAcceptHash(bob.address, ethId, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);
        expect(await periphery.getAcceptor(fwAId, hash)).to.be.eq(alice.address);

        // send value not enough
        nonce = 2;
        const amountSentNotEnough = parseEther("0.98");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountSentNotEnough}))
            .to.be.reverted;

        // send more
        const amountSentMore = parseEther("1.03");
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountSentMore}))
            .to.be.emit(periphery, "Accept")
            .withArgs(alice.address, fwAId, bob.address, ethId, amountReceive, amountReceive);
        // periphery should have no eth
        expect(await ethers.provider.getBalance(periphery.address)).to.be.eq(0);

        // send eth to a contract that has no receive or fallback function
        nonce = 3;
        await expect(periphery.connect(alice).acceptETH(alice.address, fwAId, periphery.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountReceive}))
            .to.be.reverted;

        // msg sender is not the acceptor
        nonce = 4;
        await expect(periphery.connect(defaultSender).acceptETH(alice.address, fwAId, bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountReceive}))
            .to.be.emit(periphery, "Accept")
            .withArgs(alice.address, fwAId, bob.address, ethId, amountReceive, amountReceive);
    });

    it('accept standard erc20 should success', async () => {
        const amount = parseEther("1");
        const feeRate = 100; // 1%
        let accountIdOfNonce = 15;
        let subAccountIdOfNonce = 3;
        let nonce = 1;
        const amountReceive = parseEther("0.99");
        await token2.connect(bob).mint(parseEther("100"));
        await token2.connect(bob).approve(periphery.address, amount);
        await expect(periphery.connect(bob).acceptERC20(bob.address, fwAId, alice.address, token2Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive))
            .to.be.emit(periphery, "Accept")
            .withArgs(bob.address, fwAId, alice.address, token2Id, amountReceive, amountReceive);
        let hash = calAcceptHash(alice.address, token2Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);
        expect(await periphery.getAcceptor(fwAId, hash)).to.be.eq(bob.address);
        expect(await token2.balanceOf(alice.address)).to.be.eq(amountReceive);

        // approve value not enough
        await token2.connect(bob).approve(periphery.address, parseEther("0.98"));
        nonce = 2;
        await expect(periphery.connect(bob).acceptERC20(bob.address, fwAId, alice.address, token2Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, parseEther("0.98")))
            .to.be.reverted;

        // msg sender is not the acceptor
        nonce = 3;
        await token2.connect(bob).approve(periphery.address, parseEther("2"));
        await periphery.connect(bob).brokerApprove(token2Id, defaultSender.address, parseEther("1.5"));
        await expect(periphery.connect(defaultSender).acceptERC20(bob.address, fwAId, alice.address, token2Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive))
            .to.be.emit(periphery, "Accept")
            .withArgs(bob.address, fwAId, alice.address, token2Id, amountReceive, amountReceive);
        expect(await periphery.connect(defaultSender).brokerAllowance(token2Id, bob.address, defaultSender.address)).to.eq(parseEther("0.51"));

        // broker allowance not enough
        nonce = 4;
        await expect(periphery.connect(defaultSender).acceptERC20(bob.address, fwAId, alice.address, token2Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive))
            .to.be.revertedWith("F1");
    });

    it('accept non standard erc20 should success', async () => {
        const amount = parseEther("1");
        const feeRate = 100; // 1%
        let accountIdOfNonce = 15;
        let subAccountIdOfNonce = 3;
        let nonce = 1;
        const amountReceive = parseEther("0.99");
        const amountTransfer = parseEther("1.2375"); // to address will be taken 20% fee within transfer
        const amountSent = parseEther("1.36125"); // from address will be taken 10% fee within transfer
        await token3.connect(bob).mint(parseEther("100"));
        await token3.connect(bob).approve(periphery.address, amountTransfer);
        await expect(periphery.connect(bob).acceptERC20(bob.address, fwAId, alice.address, token3Id, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountTransfer))
            .to.be.emit(periphery, "Accept")
            .withArgs(bob.address, fwAId, alice.address, token3Id, amountSent, amountReceive);
    });
});
