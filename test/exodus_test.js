const { expect } = require('chai');
const { IS_MASTER_CHAIN, deploy} = require('./utils');
const { writeDepositPubdata, extendAddress} = require('../script/op_utils');
const {parseEther} = require("ethers/lib/utils");

if (!IS_MASTER_CHAIN) {
    console.log("ZkLink exodus unit tests only support master chain");
    return;
}

describe('ZkLink exodus unit tests', function () {
    let deployedInfo;
    let zkLink, periphery, verifier, ethId, token2, token2Id, defaultSender, alice, governor;
    let storedBlockTemplate;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        periphery = deployedInfo.periphery;
        verifier = deployedInfo.verifier;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        governor = deployedInfo.governor;
        verifier = deployedInfo.verifier;

        storedBlockTemplate = {
            "blockNumber":5,
            "priorityOperations":7,
            "pendingOnchainOperationsHash":"0xcf2ef9f8da5935a514cc25835ea39be68777a2674197105ca904600f26547ad2",
            "timestamp":1652422395,
            "stateHash":"0xbb66ffc06a476f05a218f6789ca8946e4f0cf29f1efc2e4d0f9a8e70f0326313",
            "commitment":"0x6104d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "syncHashs":[]
        };
    });

    it('performExodus and cancelOutstandingDepositsForExodusMode should be failed when active', async () => {
        const owner = extendAddress(defaultSender.address);
        const accountId = 245;
        const subAccountId = 2;
        const tokenId = 58;
        const amount = parseEther("1.56");
        const proof = [3,0,9,5];
        await expect(periphery.connect(defaultSender).performExodus(storedBlockTemplate,
            owner,
            accountId,
            subAccountId,
            tokenId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("1");

        await expect(periphery.connect(defaultSender).cancelOutstandingDepositsForExodusMode(3, []))
            .to.be.revertedWith("1");
    });

    it('active exodus should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(extendAddress(to), subAccountId, {value: amount});
        // expire block is zero in UnitTest environment
        await expect(periphery.connect(defaultSender).activateExodusMode()).to.be.emit(zkLink, "ExodusMode");
        await expect(periphery.connect(defaultSender).activateExodusMode()).to.be.revertedWith("0");
    });

    it('performExodus should success', async () => {
        const block5 = storedBlockTemplate;
        const block6 = Object.assign({}, storedBlockTemplate);
        block6.blockNumber = 6;
        await zkLink.mockExecBlock(block5);
        await zkLink.mockExecBlock(block6);

        const owner = extendAddress(defaultSender.address);
        const accountId = 245;
        const subAccountId = 2;
        const tokenId = 58;
        const amount = parseEther("1.56");
        const proof = [3,0,9,5];

        // not the last executed block
        await expect(periphery.connect(defaultSender).performExodus(block5,
            owner,
            accountId,
            subAccountId,
            tokenId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("y1");

        // verify failed
        await verifier.setVerifyResult(false);
        await expect(periphery.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("y2");

        // pending balance should increase if success
        await verifier.setVerifyResult(true);
        await expect(periphery.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            tokenId,
            amount,
            proof))
            .to.be.emit(zkLink, "WithdrawalPending")
            .withArgs(tokenId, owner, amount);
        expect(await periphery.getPendingBalance(owner, tokenId)).to.be.eq(amount);

        // duplicate perform should be failed
        await expect(periphery.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId,
            tokenId,
            tokenId,
            amount,
            proof))
            .to.be.revertedWith("y0");

        // diff subAccount should success
        const subAccountId1 = 3;
        const amount1 = parseEther("0.5");
        await expect(periphery.connect(defaultSender).performExodus(block6,
            owner,
            accountId,
            subAccountId1,
            tokenId,
            tokenId,
            amount1,
            proof))
            .to.be.emit(zkLink, "WithdrawalPending")
            .withArgs(tokenId, owner, amount1);
        expect(await periphery.getPendingBalance(owner, tokenId)).to.be.eq(amount.add(amount1));
    });

    it('cancelOutstandingDepositsForExodusMode should success', async () => {
        // there should be priority requests exist
        await periphery.setTotalOpenPriorityRequests(0);
        await expect(periphery.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("A0");

        await zkLink.setExodus(false);
        await token2.connect(defaultSender).mint(parseEther("1000"));
        await token2.connect(defaultSender).approve(zkLink.address, parseEther("1000"));

        const amount0 = parseEther("4");
        const amount1 = parseEther("10");
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount0, extendAddress(defaultSender.address), 0, false);
        await zkLink.connect(alice).requestFullExit(14, 2, token2Id, false);
        await zkLink.connect(defaultSender).depositERC20(token2.address, amount1, extendAddress(alice.address), 1, false);
        await zkLink.setExodus(true);

        const pubdata0 = writeDepositPubdata({ chainId:1, subAccountId:0, tokenId:token2Id, targetTokenId:token2Id, amount:amount0, owner:extendAddress(defaultSender.address) });
        const pubdata1 = writeDepositPubdata({ chainId:1, subAccountId:1, tokenId:token2Id, targetTokenId:token2Id, amount:amount1, owner:extendAddress(alice.address) });

        await periphery.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
        expect(await periphery.getPendingBalance(extendAddress(defaultSender.address), token2Id)).to.be.eq(amount0);
        expect(await periphery.getPendingBalance(extendAddress(alice.address), token2Id)).to.be.eq(amount1);
    });
});
