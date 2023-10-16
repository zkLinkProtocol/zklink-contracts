const { ethers } = require('hardhat');
const { expect } = require('chai');
const { deploy, MAX_ACCEPT_FEE_RATE, ETH_ADDRESS } = require('./utils');
const { calWithdrawHash } = require('../script/op_utils');
const {parseEther} = require("ethers/lib/utils");

describe('Accept unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, ethId, token2, token2Id, defaultSender, alice, bob;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
    });

    it('invalid state or params should failed when accept', async () => {
        // receiver is zero address
        await expect(periphery.connect(alice).acceptETH(ethers.constants.AddressZero, 100, 20, 10, 0, 1))
            .to.be.revertedWith("H1");
        // acceptor = receiver
        await expect(periphery.connect(alice).acceptETH(alice.address, 100, 20, 10, 0, 1))
            .to.be.revertedWith("H2");
        // fastWithdrawFeeRate = MAX_ACCEPT_FEE_RATE
        await expect(periphery.connect(alice).acceptETH(bob.address, 100, MAX_ACCEPT_FEE_RATE, 10, 0, 1))
            .to.be.revertedWith("H3");

        // accept exist
        const hash = calWithdrawHash(bob.address, ETH_ADDRESS, 100, 100, 10, 0, 1);
        await periphery.setAcceptor(hash, alice.address);
        await expect(periphery.connect(alice).acceptETH(bob.address, 100, 100, 10, 0, 1))
            .to.be.revertedWith("H4");
    });

    it('accept eth should success', async () => {
        const amount = parseEther("1");
        const feeRate = 100; // 1%
        let accountIdOfNonce = 10;
        let subAccountIdOfNonce = 0;
        let nonce = 1;
        const amountReceive = parseEther("0.99");
        await expect(periphery.connect(alice).acceptETH(bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountReceive}))
            .to.be.emit(periphery, "Accept")
            .withArgs(alice.address, bob.address, ETH_ADDRESS, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive);
        let hash = calWithdrawHash(bob.address, ETH_ADDRESS, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);
        expect(await periphery.accepts(hash)).to.be.eq(alice.address);

        // send value not enough
        nonce = 2;
        const amountSentNotEnough = parseEther("0.98");
        await expect(periphery.connect(alice).acceptETH(bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountSentNotEnough}))
            .to.be.reverted;

        // send more
        const amountSentMore = parseEther("1.03");
        await expect(periphery.connect(alice).acceptETH(bob.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountSentMore}))
            .to.be.emit(periphery, "Accept")
            .withArgs(alice.address, bob.address, ETH_ADDRESS, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive);
        // periphery should have no eth
        expect(await ethers.provider.getBalance(periphery.address)).to.be.eq(0);

        // send eth to a contract that has no receive or fallback function
        nonce = 3;
        await expect(periphery.connect(alice).acceptETH(token2.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, {value: amountReceive}))
            .to.be.reverted;
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
        await expect(periphery.connect(bob).acceptERC20(alice.address, token2.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce))
            .to.be.emit(periphery, "Accept")
            .withArgs(bob.address, alice.address, token2.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce, amountReceive);
        let hash = calWithdrawHash(alice.address, token2.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce);
        expect(await periphery.accepts(hash)).to.be.eq(bob.address);
        expect(await token2.balanceOf(alice.address)).to.be.eq(amountReceive);

        // approve value not enough
        await token2.connect(bob).approve(periphery.address, parseEther("0.98"));
        nonce = 2;
        await expect(periphery.connect(bob).acceptERC20(alice.address, token2.address, amount, feeRate, accountIdOfNonce, subAccountIdOfNonce, nonce))
            .to.be.revertedWith("ERC20: insufficient allowance");
    });
});
