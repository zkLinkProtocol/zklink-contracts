const hardhat = require('hardhat');
const { expect } = require('chai');
const { deploy, USD_TOKEN_ID, MAX_SUB_ACCOUNT_ID, MAX_ACCOUNT_ID, CHAIN_ID} = require('./utils');
const { hashBytesToBytes20, getDepositPubdata, getFullExitPubdata, extendAddress, OP_DEPOSIT_HASH_SIZE,
    OP_FULLEXIT_HASH_SIZE
} = require('../script/op_utils');
const {parseEther, parseUnits, arrayify} = require("ethers/lib/utils");

describe('ZkLink priority queue ops unit tests', function () {
    let zkLink, periphery, ethId,
        token2, token2Id, token4, token4Id, token4Mapping, token5, token5Id,
        defaultSender, governor;
    let tpn = 0;
    before(async () => {
        const deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token4 = deployedInfo.token4.contract;
        token4Id = deployedInfo.token4.tokenId;
        token4Mapping = USD_TOKEN_ID;
        token5 = deployedInfo.token5.contract;
        token5Id = deployedInfo.token5.tokenId;
        defaultSender = deployedInfo.defaultSender;
        governor = deployedInfo.governor;
    });

    it('invalid state or params should be failed when deposit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await expect(zkLink.connect(defaultSender).depositETH(extendAddress(to), subAccountId, {value: amount})).to.be.revertedWith("0");
        await token2.connect(defaultSender).mint(10000);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, extendAddress(to), 0, false)).to.be.revertedWith("0");
        await zkLink.setExodus(false);

        // token not registered
        const stFactory = await hardhat.ethers.getContractFactory('StandardToken');
        const tokenNotRegistered = await stFactory.deploy("Token not registered", "TNR");
        await tokenNotRegistered.connect(defaultSender).mint(10000);
        await tokenNotRegistered.connect(defaultSender).approve(zkLink.address, 100);
        await expect(zkLink.connect(defaultSender).depositERC20(tokenNotRegistered.address, 30, extendAddress(to), 0, false)).to.be.revertedWith("e3");

        // token deposit paused
        await periphery.connect(governor).setTokenPaused(token2Id, true);
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, extendAddress(to), 0, false)).to.be.revertedWith("e4");
        await periphery.connect(governor).setTokenPaused(token2Id, false);

        // token mapping not supported
        await expect(zkLink.connect(defaultSender).depositERC20(token2.address, 30, extendAddress(to), 0, true)).to.be.revertedWith("e5");

        // zero amount
        await expect(zkLink.connect(defaultSender).depositETH(extendAddress(to), subAccountId, {value: 0})).to.be.revertedWith("e0");

        // zero to address
        await expect(zkLink.connect(defaultSender).depositETH(extendAddress(hardhat.ethers.constants.AddressZero), subAccountId, {value: amount})).to.be.revertedWith("e1");

        // subAccountId too large
        const tooLargeSubId = MAX_SUB_ACCOUNT_ID + 1; // 2**5
        await expect(zkLink.connect(defaultSender).depositETH(extendAddress(to), tooLargeSubId, {value: amount})).to.be.revertedWith("e2");
    });

    it('deposit eth should success', async () => {
        const balance0 = await ethers.provider.getBalance(zkLink.address);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(extendAddress(to), subAccountId, {value: amount});
        const balance1 = await ethers.provider.getBalance(zkLink.address);
        expect(balance1.sub(balance0)).eq(amount);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:CHAIN_ID, accountId:0, subAccountId, tokenId:ethId, targetTokenId:ethId, amount, owner:extendAddress(to) });
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_DEPOSIT_HASH_SIZE)));
    });

    it('deposit standard erc20 should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = 30;
        await token2.connect(defaultSender).mint(10000);
        let senderBalance = await token2.balanceOf(defaultSender.address);
        let contractBalance = await token2.balanceOf(zkLink.address);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount, extendAddress(to), subAccountId, false);
        expect(await token2.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token2.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:CHAIN_ID, accountId:0, subAccountId, tokenId:token2Id, targetTokenId:token2Id, amount, owner:extendAddress(to) });
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_DEPOSIT_HASH_SIZE)));
    });

    it('deposit erc20 with mapping should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = 30;
        await token4.connect(defaultSender).mint(10000);
        let senderBalance = await token4.balanceOf(defaultSender.address);
        let contractBalance = await token4.balanceOf(zkLink.address);
        await token4.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token4.address, amount, extendAddress(to), subAccountId, true);
        expect(await token4.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token4.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getDepositPubdata({ chainId:CHAIN_ID, accountId:0, subAccountId, tokenId:token4Id, targetTokenId:token4Mapping, amount, owner:extendAddress(to) });
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_DEPOSIT_HASH_SIZE)));
    });

    it('deposit standard erc20 with decimals should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseUnits("30000000", "wei"); // 30 * 10^6
        await token5.connect(defaultSender).mint(parseUnits("10000000000", "wei")); // 10000 * 10 ^6
        let senderBalance = await token5.balanceOf(defaultSender.address);
        let contractBalance = await token5.balanceOf(zkLink.address);
        await token5.connect(defaultSender).approve(zkLink.address, parseUnits("100000000", "wei")); // 100 * 10 ^6
        await zkLink.connect(defaultSender).depositERC20(token5.address, amount, extendAddress(to), subAccountId, false);
        expect(await token5.balanceOf(zkLink.address)).equal(contractBalance.add(amount));
        expect(await token5.balanceOf(defaultSender.address)).equal(senderBalance.sub(amount));

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const amountInPubdata = parseEther("30"); // 30 * 10 ^18
        const encodePubdata = getDepositPubdata({ chainId:CHAIN_ID, accountId:0, subAccountId, tokenId:token5Id, targetTokenId:token5Id, amount:amountInPubdata, owner:extendAddress(to) });
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_DEPOSIT_HASH_SIZE)));
    });

    it('invalid state or params should be failed when full exit', async () => {
        // exodus
        await zkLink.setExodus(true);
        const accountId = 13;
        const subAccountId = 0;
        await expect(zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, ethId, false)).to.be.revertedWith("0");
        await zkLink.setExodus(false);

        // accountId too large
        const tooLargeAccountId = MAX_ACCOUNT_ID + 1; // 2**24
        await expect(zkLink.connect(defaultSender).requestFullExit(tooLargeAccountId, subAccountId, ethId, false)).to.be.revertedWith("a0");

        // subAccountId too large
        const tooLargeSubId = MAX_SUB_ACCOUNT_ID + 1; // 2**5
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
        const encodePubdata = getFullExitPubdata({ chainId:CHAIN_ID, accountId, subAccountId, owner:extendAddress(defaultSender.address), tokenId:ethId, srcTokenId:ethId, amount:0});
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_FULLEXIT_HASH_SIZE)));
    });

    it('requestFullExit with mapping should success', async () => {
        const accountId = 13;
        const subAccountId = 0;
        await zkLink.connect(defaultSender).requestFullExit(accountId, subAccountId, token4Id, true);

        const hashedPubdata = await zkLink.getPriorityHash(tpn++);
        const encodePubdata = getFullExitPubdata({ chainId:CHAIN_ID, accountId, subAccountId, owner:extendAddress(defaultSender.address), tokenId:token4Id, srcTokenId:token4Mapping, amount:0});
        expect(hashedPubdata).eq(hashBytesToBytes20(arrayify(encodePubdata).slice(0, OP_FULLEXIT_HASH_SIZE)));
    });
});
