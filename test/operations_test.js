const hardhat = require('hardhat');
const {getDepositPubdata,
    getPartialExitPubdata,
    getFullExitPubdata,
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
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId, accountId, tokenId, amount, owner };
        const pubdata = getDepositPubdata(example);
        await testContract.testDepositPubdata(example, pubdata);
    });

    it('Correctly Write Deposit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        await testContract.testWriteDepositPubdata({ chainId, accountId, tokenId, amount, owner });
    });

    // PartialExit
    it('Correctly Parse PartialExit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0102';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const nonce = '0x00000001';
        const isFastWithdraw = '0x01';
        const fastWithdrawFee = '0x0102';

        const example = { chainId, accountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFee };
        const pubdata = getPartialExitPubdata(example);
        await testContract.testPartialExitPubdata(example, pubdata);
    });

    // FullExit
    it('Correctly Parse FullExit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { chainId, accountId, owner, tokenId, amount };
        const pubdata = getFullExitPubdata(example);
        await testContract.testFullExitPubdata(example, pubdata);
    });

    it('Correctly Write FullExit pubdata', async () => {
        const chainId = '0x01';
        const accountId = '0x01020304';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { chainId, accountId, owner, tokenId, amount };
        await testContract.testWriteFullExitPubdata(example);
    });

    // ChangePubKey
    it('Correctly Parse ChangePubKey pubdata', async () => {
        const offset = '0x010203';
        const accountId = '0x01020304';
        const pubKeyHash = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const nonce = '0x01020304';

        const example = { offset, accountId, pubKeyHash, owner, nonce };
        const pubdata = getChangePubkeyPubdata(example);
        await testContract.testChangePubkeyPubdata(example, pubdata);
    });
});
