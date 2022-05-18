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
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:13, subAccountId:0, tokenId:25, amount:100, owner };
        const pubdata = getDepositPubdata(example);
        await testContract.testDepositPubdata(example, pubdata);
    });

    it('Correctly Write Deposit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        await testContract.testWriteDepositPubdata({ chainId:1, accountId:13, subAccountId:0, tokenId:25, amount:100, owner });
    });

    // Withdraw
    it('Correctly Parse Withdraw pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const example = { chainId:1, accountId:32, subAccountId:4, tokenId:34, amount:32, fee:14, owner, nonce:45, fastWithdrawFeeRate:45 };
        const pubdata = getWithdrawPubdata(example);
        await testContract.testWithdrawPubdata(example, pubdata);
    });

    // FullExit
    it('Correctly Parse FullExit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:34, subAccountId:23, owner, tokenId:2, amount:15 };
        const pubdata = getFullExitPubdata(example);
        await testContract.testFullExitPubdata(example, pubdata);
    });

    it('Correctly Write FullExit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const example = { chainId:1, accountId:34, subAccountId:23, owner, tokenId:2, amount:15 };
        await testContract.testWriteFullExitPubdata(example);
    });

    // ForcedExit
    it('Correctly Parse ForcedExit pubdata', async () => {
        const target = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, initiatorAccountId:2, targetAccountId:3, targetSubAccountId:4, tokenId:5, amount:6, fee:7, target };
        const pubdata = getForcedExitPubdata(example);
        await testContract.testForcedExitPubdata(example, pubdata);
    });

    // ChangePubKey
    it('Correctly Parse ChangePubKey pubdata', async () => {
        const pubKeyHash = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:2, pubKeyHash, owner, nonce:3, tokenId:4, fee:5 };
        const pubdata = getChangePubkeyPubdata(example);
        await testContract.testChangePubkeyPubdata(example, pubdata);
    });
});
