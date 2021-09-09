const hardhat = require('hardhat');
const {getDepositPubdata,
    getPartialExitPubdata,
    getFullExitPubdata,
    getChangePubkeyPubdata,
    getQuickSwapPubdata,
    getMappingPubdata} = require('./utils');

describe('Operations unit tests', function () {
    let testContract;
    before(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('OperationsTest');
        testContract = await contractFactory.deploy();
    });

    // Deposit
    it('Correctly Parse Deposit pubdata', async () => {
        const accountId = '0x01020304';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { accountId, tokenId, amount, owner };
        const pubdata = getDepositPubdata(example);
        await testContract.testDepositPubdata(example, pubdata);
    });

    it('Correctly Write Deposit pubdata', async () => {
        const accountId = '0x01020304';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        await testContract.testWriteDepositPubdata({ accountId, tokenId, amount, owner });
    });

    // PartialExit
    it('Correctly Parse PartialExit pubdata', async () => {
        const accountId = '0x01020304';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0102';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { accountId, tokenId, amount, fee, owner };
        const pubdata = getPartialExitPubdata(example);
        await testContract.testPartialExitPubdata(example, pubdata);
    });

    // FullExit
    it('Correctly Parse FullExit pubdata', async () => {
        const accountId = '0x01020304';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { accountId, owner, tokenId, amount };
        const pubdata = getFullExitPubdata(example);
        await testContract.testFullExitPubdata(example, pubdata);
    });

    it('Correctly Write FullExit pubdata', async () => {
        const accountId = '0x01020304';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';

        const example = { accountId, owner, tokenId, amount };
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

    // QuickSwap
    it('Correctly Parse QuickSwap pubdata', async () => {
        const fromChainId = '0x00';
        const toChainId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const fromTokenId = '0x0102';
        const amountIn = '0x101112131415161718191a1b1c1d1e1f';
        const to = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const toTokenId = '0x0103';
        const amountOutMin = '0x001112131415161718191a1b1c1d1e1f';
        const withdrawFee = '0x0001';
        const nonce = '0x01020304';

        const example = { fromChainId, toChainId, owner, fromTokenId, amountIn, to, toTokenId, amountOutMin, withdrawFee, nonce };
        const pubdata = getQuickSwapPubdata(example);
        await testContract.testQuickSwapPubdata(example, pubdata);
    });

    it('Correctly Write QuickSwap pubdata', async () => {
        const fromChainId = '0x00';
        const toChainId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const fromTokenId = '0x0102';
        const amountIn = '0x101112131415161718191a1b1c1d1e1f';
        const to = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const toTokenId = '0x0103';
        const amountOutMin = '0x001112131415161718191a1b1c1d1e1f';
        const withdrawFee = '0x0001';
        const nonce = '0x01020304';

        const example = { fromChainId, toChainId, owner, fromTokenId, amountIn, to, toTokenId, amountOutMin, withdrawFee, nonce };
        await testContract.testWriteQuickSwapPubdata(example);
    });

    // Mapping
    it('Correctly Parse Mapping pubdata', async () => {
        const fromChainId = '0x00';
        const toChainId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0003';

        const example = { fromChainId, toChainId, owner, tokenId, amount, fee };
        const pubdata = getMappingPubdata(example);
        await testContract.testCreateMappingPubdata(example, pubdata);
    });

    it('Correctly Write Mapping pubdata', async () => {
        const fromChainId = '0x00';
        const toChainId = '0x01';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const tokenId = '0x0102';
        const amount = '0x101112131415161718191a1b1c1d1e1f';
        const fee = '0x0003';

        const example = { fromChainId, toChainId, owner, tokenId, amount, fee };
        await testContract.testWriteMappingPubdata(example);
    });
});
