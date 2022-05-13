const { expect } = require('chai');
const { deploy, writeDepositPubdata } = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink exodus unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, token3, token3Id, defaultSender, alice, governance, governor, verifier;
    let storedBlockTemplate;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        governance = deployedInfo.governance;
        governor = deployedInfo.governor;
        verifier = deployedInfo.verifier;

        storedBlockTemplate = {
            "blockNumber":5,
            "priorityOperations":7,
            "pendingOnchainOperationsHash":"0xcf2ef9f8da5935a514cc25835ea39be68777a2674197105ca904600f26547ad2",
            "timestamp":1652422395,
            "stateHash":"0xbb66ffc06a476f05a218f6789ca8946e4f0cf29f1efc2e4d0f9a8e70f0326313",
            "commitment":"0x6104d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184"
        };
    });

    it('performExodus and cancelOutstandingDepositsForExodusMode should be failed when active', async () => {
        const owner = defaultSender.address;
        const accountId = 245;
        const subAccountId = 2;
        const tokenId = 58;
        const amount = parseEther("1.56");
        const proof = [3,0,9,5];
        await expect(zkLink.connect(defaultSender).performExodus(storedBlockTemplate,
            owner,
            accountId,
            subAccountId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("Z1");

        await expect(zkLink.connect(defaultSender).cancelOutstandingDepositsForExodusMode(3, []))
            .to.be.revertedWith("Z1");
    });

    it('active exodus should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount});
        await zkLink.connect(defaultSender).setPriorityExpirationBlock(0, 1);
        await expect(zkLink.connect(defaultSender).activateExodusMode()).to.be.emit(zkLink, "ExodusMode");
        await expect(zkLink.connect(defaultSender).activateExodusMode()).to.be.revertedWith("Z0");
    });

    it('performExodus should success', async () => {
        const block5 = storedBlockTemplate;
        const block6 = Object.assign({}, storedBlockTemplate);
        block6.blockNumber = 6;
        await zkLink.mockExecBlock(block5);
        await zkLink.mockExecBlock(block6);

        const owner = defaultSender.address;
        const accountId = 245;
        const subAccountId = 2;
        const tokenId = 58;
        const amount = parseEther("1.56");
        const proof = [3,0,9,5];

        // not the last executed block
        await expect(zkLink.connect(defaultSender).performExodus(block5,
            owner,
            accountId,
            subAccountId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("Z7");

        // verify failed
        await verifier.setVerifyResult(false);
        await expect(zkLink.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("Z8");

        // pending balance should increase if success
        await verifier.setVerifyResult(true);
        await expect(zkLink.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            amount,
            proof))
            .to.be.emit(zkLink, "WithdrawalPending")
            .withArgs(tokenId, owner, amount);
        expect(await zkLink.getPendingBalance(owner, tokenId)).to.be.eq(amount);

        // duplicate perform should be failed
        await expect(zkLink.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("Z6");

        // diff subAccount should success
        const subAccountId1 = 3;
        const amount1 = parseEther("0.5");
        await expect(zkLink.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId1,
            tokenId,
            amount1,
            proof))
            .to.be.emit(zkLink, "WithdrawalPending")
            .withArgs(tokenId, owner, amount1);
        expect(await zkLink.getPendingBalance(owner, tokenId)).to.be.eq(amount.add(amount1));
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        // there should be priority requests exist
        await zkLink.setTotalOpenPriorityRequests(0);
        await expect(zkLink.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("Z9");

        await zkLink.setExodus(false);
        await token2.connect(defaultSender).mint(parseEther("1000"));
        await token2.connect(defaultSender).approve(zkLink.address, parseEther("1000"));

        const amount0 = parseEther("4");
        const amount1 = parseEther("10");
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount0, defaultSender.address, 0);
        await zkLink.connect(alice).requestFullExit(14, 2, token3Id);
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount1, alice.address, 1);
        await zkLink.setExodus(true);

        const pubdata0 = writeDepositPubdata({ chainId:1, subAccountId:0, tokenId:token2Id, amount:amount0, owner:defaultSender.address });
        const pubdata1 = writeDepositPubdata({ chainId:1, subAccountId:1, tokenId:token2Id, amount:amount1, owner:alice.address });

        await zkLink.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
        expect(await zkLink.getPendingBalance(defaultSender.address, token2Id)).to.be.eq(amount0);
        expect(await zkLink.getPendingBalance(alice.address, token2Id)).to.be.eq(amount1);
    });
});
