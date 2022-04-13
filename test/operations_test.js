const hardhat = require('hardhat');
const {getDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata} = require('./utils');

describe('Operations unit tests', function () {
    let testContract;
    before(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('OperationsTest');
        testContract = await contractFactory.deploy();
    });

    // Deposit
    it('Correctly Parse Deposit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const subAccountId = '0x01';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId, accountId, subAccountId, tokenId, amount, owner };
        const pubdata = getDepositPubdata(example);
        await testContract.testDepositPubdata(example, pubdata);
    });

    it('Correctly Write Deposit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const subAccountId = '0x01';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        await testContract.testWriteDepositPubdata({ chainId, accountId, subAccountId, tokenId, amount, owner });
    });

    // Withdraw
    it('Correctly Parse Withdraw pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const subAccountId = '0x01';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0102';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const nonce = '0x00000001';
        const isFastWithdraw = '0x01';
        const fastWithdrawFeeRate = '0x0102';

        const example = { chainId, accountId, subAccountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFeeRate };
        const pubdata = getWithdrawPubdata(example);
        await testContract.testWithdrawPubdata(example, pubdata);
    });

    // FullExit
    it('Correctly Parse FullExit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const subAccountId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { chainId, accountId, subAccountId, owner, tokenId, amount };
        const pubdata = getFullExitPubdata(example);
        await testContract.testFullExitPubdata(example, pubdata);
    });

    it('Correctly Write FullExit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const subAccountId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { chainId, accountId, subAccountId, owner, tokenId, amount };
        await testContract.testWriteFullExitPubdata(example);
    });

    // ForcedExit
    it('Correctly Parse ForcedExit pubdata', async () => {
        const chainId = '0x01';
        const initiatorAccountId = '0x01020304';
        const targetAccountId = '0x01020305';
        const targetSubAccountId = '0x01';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0102';
        const target = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId, initiatorAccountId, targetAccountId, targetSubAccountId, tokenId, amount, fee, target };
        const pubdata = getForcedExitPubdata(example);
        await testContract.testForcedExitPubdata(example, pubdata);
    });

    // ChangePubKey
    it('Correctly Parse ChangePubKey pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const pubKeyHash = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const nonce = '0x01020304';

        const example = { chainId, accountId, pubKeyHash, owner, nonce };
        const pubdata = getChangePubkeyPubdata(example);
        await testContract.testChangePubkeyPubdata(example, pubdata);
    });
});
