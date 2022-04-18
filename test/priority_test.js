const hardhat = require('hardhat');
const { expect } = require('chai');
const { deploy, hashBytesToBytes20, getDepositPubdata, getFullExitPubdata} = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink priority queue ops unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, token3, token3Id, defaultSender, governance, governor;
    let tpn = 0;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        governance = deployedInfo.governance;
        governor = deployedInfo.governor;
    });

    it('invalid state or params should be failed when deposit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount})).to.be.revertedWith("Z0");
        await token2.connect(defaultSender).mint(10000);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0)).to.be.revertedWith("Z0");
        await zkLink.setExodus(false);

        // ddos?
        await zkLink.setTotalOpenPriorityRequests(4096);
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount})).to.be.revertedWith("Z35");
        await zkLink.setTotalOpenPriorityRequests(tpn);

        // token not registered
        const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
        const tokenNotRegistered = await stFactory.deploy("Token not registered", "TNR");
        await tokenNotRegistered.connect(defaultSender).mint(10000);
        await tokenNotRegistered.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(tokenNotRegistered.address, 30, to, 0)).to.be.revertedWith("Z31");

        // token deposit paused
        await governance.connect(governor).setTokenPaused(token2Id, true);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0)).to.be.revertedWith("Z32");
        await governance.connect(governor).setTokenPaused(token2Id, false);

        // zero amount
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: 0})).to.be.revertedWith("Z33");

        // zero to address
        await expect(zkLink.connect(defaultSender).depositETH(hardhat.ethers.constants.AddressZero, subAccountId, {value: amount})).to.be.revertedWith("Z34");

        // subAccountId too large
        const tooLargeSubId = 8; // 2**3
        await expect(zkLink.connect(defaultSender).depositETH(to, tooLargeSubId, {value: amount})).to.be.revertedWith("Z30");
    });

    it('deposit eth should success', async () => {
        const balance0 = await ethers.provider.getBalance(zkLink.address);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount});
        const balance1 = await ethers.provider.getBalance(zkLink.address);
        expect(balance1.sub(balance0)).eq(amount);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:ethId, amount, owner:to });
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('deposit standard erc20 should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = 30;
        await token2.connect(defaultSender).mint(10000);
        let senderBalance = await token2.balanceOf(defaultSender.address);
        let contractBalance = await token2.balanceOf(zkLink.address);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount, to, subAccountId);
        expect(await token2.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token2.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:token2Id, amount, owner:to });
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('deposit non standard erc20 should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = 30;
        const senderFee = 3; // 30 * 0.1
        const receiverFee = 6; // 30 * 0.2
        await token3.connect(defaultSender).mint(10000);
        let senderBalance = await token3.balanceOf(defaultSender.address);
        let contractBalance = await token3.balanceOf(zkLink.address);
        await token3.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token3.address, amount, to, subAccountId);
        expect(await token3.balanceOf(zkLink.address)).equal(contractBalance.add(amount-receiverFee));
        expect(await token3.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount+senderFee));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:token3Id, amount:amount-receiverFee, owner:to });
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('invalid state or params should be failed when full exit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const accountId = 13;
        const subAccountId = 0;
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId)).to.be.revertedWith("Z0");
        await zkLink.setExodus(false);

        // ddos?
        await zkLink.setTotalOpenPriorityRequests(4096);
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId)).to.be.revertedWith("Z5");
        await zkLink.setTotalOpenPriorityRequests(tpn);

        // accountId too large
        const tooLargeAccountId = 16777216; // 2**24
        await expect(zkLink.connect(defaultSender).requestFullExit(tooLargeAccountId, subAccountId, ethId)).to.be.revertedWith("Z2");

        // subAccountId too large
        const tooLargeSubId = 8; // 2**3
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, tooLargeSubId, ethId)).to.be.revertedWith("Z3");

        // tokenId not registered
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, 10000)).to.be.revertedWith("Z4");
    });

    it('requestFullExit should success', async () => {
        const accountId = 13;
        const subAccountId = 0;
        await zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getFullExitPubdata({ chainId:1, accountId, subAccountId, owner:defaultSender.address, tokenId:ethId, amount:0});
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });
});
