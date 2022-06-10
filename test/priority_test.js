const hardhat = require('hardhat');
const { expect } = require('chai');
const { deploy, hashBytesToBytes20, getDepositPubdata, getFullExitPubdata} = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink priority queue ops unit tests', function () {
    let zkLink, periphery, ethId, token2, token2Id, token3, token3Id, token4, token4Id, token4Mapping, defaultSender, governor;
    let tpn = 0;
    before(async () => {
        const deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        token4 = deployedInfo.token4.contract;
        token4Id = deployedInfo.token4.tokenId;
        token4Mapping = deployedInfo.token4.mappingToken;
        defaultSender = deployedInfo.defaultSender;
        governor = deployedInfo.governor;
    });

    it('invalid state or params should be failed when deposit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount})).to.be.revertedWith("0");
        await token2.connect(defaultSender).mint(10000);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0, false)).to.be.revertedWith("0");
        await zkLink.setExodus(false);

        // ddos?
        await periphery.setTotalOpenPriorityRequests(4096);
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount})).to.be.revertedWith("e6");
        await periphery.setTotalOpenPriorityRequests(tpn);

        // token not registered
        const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
        const tokenNotRegistered = await stFactory.deploy("Token not registered", "TNR");
        await tokenNotRegistered.connect(defaultSender).mint(10000);
        await tokenNotRegistered.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(tokenNotRegistered.address, 30, to, 0, false)).to.be.revertedWith("e3");

        // token deposit paused
        await periphery.connect(governor).setTokenPaused(token2Id, true);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0, false)).to.be.revertedWith("e4");
        await periphery.connect(governor).setTokenPaused(token2Id, false);

        // token mapping not supported
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0, true)).to.be.revertedWith("e5");

        // zero amount
        await expect(zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: 0})).to.be.revertedWith("e0");

        // zero to address
        await expect(zkLink.connect(defaultSender).depositETH(hardhat.ethers.constants.AddressZero, subAccountId, {value: amount})).to.be.revertedWith("e1");

        // subAccountId too large
        const tooLargeSubId = 8; // 2**3
        await expect(zkLink.connect(defaultSender).depositETH(to, tooLargeSubId, {value: amount})).to.be.revertedWith("e2");
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
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:ethId, targetTokenId:ethId, amount, owner:to });
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
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount, to, subAccountId, false);
        expect(await token2.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token2.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:token2Id, targetTokenId:token2Id, amount, owner:to });
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
        await zkLink.connect(defaultSender).depositERC20(token3.address, amount, to, subAccountId, false);
        expect(await token3.balanceOf(zkLink.address)).equal(contractBalance.add(amount-receiverFee));
        expect(await token3.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount+senderFee));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:token3Id, targetTokenId:token3Id, amount:amount-receiverFee, owner:to });
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('deposit erc20 with mapping should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = 30;
        await token4.connect(defaultSender).mint(10000);
        let senderBalance = await token4.balanceOf(defaultSender.address);
        let contractBalance = await token4.balanceOf(zkLink.address);
        await token4.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token4.address, amount, to, subAccountId, true);
        expect(await token4.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token4.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:1, accountId:0, subAccountId, tokenId:token4Id, targetTokenId:token4Mapping, amount, owner:to });
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('invalid state or params should be failed when full exit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const accountId = 13;
        const subAccountId = 0;
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId, false)).to.be.revertedWith("0");
        await zkLink.setExodus(false);

        // ddos?
        await periphery.setTotalOpenPriorityRequests(4096);
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId, false)).to.be.revertedWith("a4");
        await periphery.setTotalOpenPriorityRequests(tpn);

        // accountId too large
        const tooLargeAccountId = 16777216; // 2**24
        await expect(zkLink.connect(defaultSender).requestFullExit(tooLargeAccountId, subAccountId, ethId, false)).to.be.revertedWith("a0");

        // subAccountId too large
        const tooLargeSubId = 8; // 2**3
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, tooLargeSubId, ethId, false)).to.be.revertedWith("a1");

        // tokenId not registered
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, 10000, false)).to.be.revertedWith("a2");

        // token mapping not supported
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId, true)).to.be.revertedWith("a3");
    });

    it('requestFullExit should success', async () => {
        const accountId = 13;
        const subAccountId = 0;
        await zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId, false);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getFullExitPubdata({ chainId:1, accountId, subAccountId, owner:defaultSender.address, tokenId:ethId, srcTokenId:ethId, amount:0});
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });

    it('requestFullExit with mapping should success', async () => {
        const accountId = 13;
        const subAccountId = 0;
        await zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, token4Id, true);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getFullExitPubdata({ chainId:1, accountId, subAccountId, owner:defaultSender.address, tokenId:token4Id, srcTokenId:token4Mapping, amount:0});
        expect(hashedPubdata).eq(hashBytesToBytes20(encodePubdata));
    });
});
