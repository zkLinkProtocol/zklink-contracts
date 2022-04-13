const hardhat = require('hardhat');
const { expect } = require('chai');
const { writeDepositPubdata, deploy } = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink priority queue ops unit tests', function () {
    let deployedInfo;
    let zkLink, token2, token2Id, defaultSender;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        defaultSender = deployedInfo.defaultSender;
    });

    // it('should revert when exodusMode is active', async () => {
    //     await zkSync.setExodusMode(true);
    //     await expect(zkSync.depositERC20(tokenA, 100, wallet.address)).to.be.revertedWith("L");
    //     await expect(zkSync.requestFullExit(1, tokenA)).to.be.revertedWith("L");
    // });

    // it('should revert when update zkLinkBlock address in logic contract', async () => {
    //     const zkLinkHackerFactory = await hardhat.ethers.getContractFactory('ZkLinkHacker');
    //     const zkLinkHacker = await zkLinkHackerFactory.deploy();
    //     await zkSync.setProxyMode(false);
    //     await expect(zkSync.upgrade(hardhat.ethers.utils.defaultAbiCoder.encode(['address','address'], [zkLinkHacker.address, zkLinkHacker.address])))
    //         .to.be.revertedWith("ZkLink: call should be in proxy mode");
    // });

    it('deposit eth should success', async () => {
        const balance0 = await ethers.provider.getBalance(zkLink.address);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.depositETH(to, subAccountId, {value: amount});
        const balance1 = await ethers.provider.getBalance(zkLink.address);
        expect(balance1.sub(balance0)).eq(amount);
    });

    it('deposit erc20 should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        let senderBalance = await token2.balanceOf(defaultSender.address);
        let contractBalance = await token2.balanceOf(zkLink.address);
        await token2.connect(defaultSender).approve(zkLink.address, 100);
        await zkLink.connect(defaultSender).depositERC20(token2.address, 30, to, 0);
        expect(await token2.balanceOf(zkLink.address)).equal(contractBalance.add(30));
        expect(await token2.balanceOf(defaultSender.address)).equal(senderBalance.sub(30));
    });

    // it('cancelOutstandingDepositsForExodusMode should success', async () => {
    //     // require exodus mode
    //     await expect(zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("8");
    //
    //     // no deposits to process
    //     await zkSync.setExodusMode(true);
    //     await expect(zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [])).to.be.revertedWith("9");
    //
    //     await zkSync.setExodusMode(false);
    //     await tokenD.approve(zkSync.address, 100);
    //     await zkSync.depositERC20(tokenD.address, 30, alice.address);
    //     await zkSync.depositERC20(tokenD.address, 20, alice.address);
    //
    //     const chainId = '0x01';
    //     const tokenId = '0x0003';
    //     const amount0 = '0x0000000000000000000000000000001e';
    //     const amount1 = '0x00000000000000000000000000000014';
    //     const owner = alice.address;
    //     const pubdata0 = writeDepositPubdata({ chainId, tokenId, amount:amount0, owner });
    //     const pubdata1 = writeDepositPubdata({ chainId, tokenId, amount:amount1, owner });
    //
    //     await zkSync.setExodusMode(true);
    //     const b0 = await tokenD.balanceOf(alice.address);
    //     await zkSyncExit.cancelOutstandingDepositsForExodusMode(3, [pubdata0, pubdata1]);
    //     const b1 = await tokenD.balanceOf(alice.address);
    //     expect(b1.sub(b0)).to.be.equal(50);
    // });

    // it('requestFullExit should success', async () => {
    //     // account id can not over limit
    //     const MAX_ACCOUNT_ID = (2**24) - 1;
    //     await expect(zkSync.requestFullExit(MAX_ACCOUNT_ID + 1, tokenA)).to.be.revertedWith("e");
    //
    //     await expect(zkSync.connect(wallet).requestFullExit(1, tokenA)).to
    //         .emit(zkSync, 'NewPriorityRequest');
    // });

    // it('createBlockCommitment contain self chain data should success', async () => {
    //     const previousBlock = {
    //         blockNumber:0,
    //         priorityOperations:0,
    //         pendingOnchainOperationsHash:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000'),
    //         timestamp:0,
    //         stateHash: hardhat.ethers.utils.arrayify('0x26e6e312fd7a24967587edd956f7c932b56888c44186f903a39975d27d3473c7'),
    //         commitment:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000')
    //     }
    //     const newBlockData = {
    //         newStateHash:hardhat.ethers.utils.arrayify('0x1a2ef2aa9f890664ce7b3e412272495d45858b2443d9d375d9adcb3699630fcf'),
    //         publicData:hardhat.ethers.utils.arrayify('0x0b000000000001000000026fc23ac00900000001000000000100000000000000000000000b000000000001000000026fc23ac0090000000100000000010000000000000000000000'),
    //         timestamp:305419896,
    //         onchainOperations: [{ethWitness:[],publicDataOffset:0},{ethWitness:[],publicDataOffset:36}],
    //         blockNumber:1,
    //         feeAccount:0
    //     }
    //     const offsetCommitment = hardhat.ethers.utils.arrayify('0x0000000000000000');
    //     expect(await zkSyncBlock.testBlockCommitment(previousBlock, newBlockData, offsetCommitment)).to.equal('0xe7b31627476f17be31f1377910f7c44eb41d91ad26144b79dd682e891a4fb6cf');
    // });
    //
    // it('createBlockCommitment contain cross chain data should success', async () => {
    //     const previousBlock = {
    //         blockNumber:0,
    //         priorityOperations:0,
    //         pendingOnchainOperationsHash:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000'),
    //         timestamp:0,
    //         stateHash: hardhat.ethers.utils.arrayify('0x125ff49d4c0372404e289e31068166e0653064efb93b16e49706958707d083c1'),
    //         commitment:hardhat.ethers.utils.arrayify('0x0000000000000000000000000000000000000000000000000000000000000000')
    //     }
    //     const newBlockData = {
    //         newStateHash:hardhat.ethers.utils.arrayify('0x032dd983f30763e0fc4664cc513a3832c7d6883382371732dbe3d9be14fb0cf3'),
    //         publicData:hardhat.ethers.utils.arrayify('0x0b000100000001000000026fc23ac00900000001000000000100000000000000000000000b000100000001000000026fc23ac0090000000100000000010000000000000000000000'),
    //         timestamp:305419896,
    //         onchainOperations: [{ethWitness:[],publicDataOffset:0},{ethWitness:[],publicDataOffset:36}],
    //         blockNumber:1,
    //         feeAccount:0
    //     }
    //     const offsetCommitment = hardhat.ethers.utils.arrayify('0x0000000000000000');
    //     expect(await zkSyncBlock.testBlockCommitment(previousBlock, newBlockData, offsetCommitment)).to.equal('0x107659691c238119dfcedd821c25bb8c4dacb68b0775245d4e370f582d7513b3');
    // });
});
