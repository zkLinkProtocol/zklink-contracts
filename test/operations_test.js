const hardhat = require('hardhat');
const {getDepositPubdata,
    getWithdrawPubdata,
    getFullExitPubdata,
    getForcedExitPubdata,
    getChangePubkeyPubdata, extendAddress
} = require('../script/op_utils');
const {ZERO_BYTES32} = require("./utils");

describe('Operations unit tests', function () {
    let testContract;
    before(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('OperationsTest');
        testContract = await contractFactory.deploy();
    });

    // Deposit
    it('Correctly Parse Deposit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:13, subAccountId:0, tokenId:25, targetTokenId:23, amount:100, owner:extendAddress(owner) };
        const pubdata = getDepositPubdata(example);
        await testContract.testDepositPubdata(example, pubdata);
    });

    it('Correctly Write Deposit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        await testContract.testWriteDepositPubdata({ chainId:1, accountId:13, subAccountId:0, tokenId:25, targetTokenId:23, amount:100, owner:extendAddress(owner) });
    });

    // Withdraw
    it('Correctly Parse Withdraw pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const example = { chainId:1, accountId:32, subAccountId:4, tokenId:34, srcTokenId:34, amount:32, fee:14, owner:extendAddress(owner), nonce:45, fastWithdrawFeeRate:45, withdrawToL1: 1, dataHash: ZERO_BYTES32 };
        const pubdata = getWithdrawPubdata(example);
        example.owner = owner;
        await testContract.testWithdrawPubdata(example, pubdata);
    });

    // FullExit
    it('Correctly Parse FullExit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:34, subAccountId:23, owner:extendAddress(owner), tokenId:2, srcTokenId:1, amount:15 };
        const pubdata = getFullExitPubdata(example);
        example.owner = owner;
        await testContract.testFullExitPubdata(example, pubdata);
    });

    it('Correctly Write FullExit pubdata', async () => {
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const example = { chainId:1, accountId:34, subAccountId:23, owner, tokenId:2, srcTokenId:1, amount:15 };
        await testContract.testWriteFullExitPubdata(example);
    });

    // ForcedExit
    it('Correctly Parse ForcedExit pubdata', async () => {
        const target = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, initiatorAccountId:2, initiatorSubAccountId:1, initiatorNonce:5, targetAccountId:3, targetSubAccountId:4, tokenId:5, srcTokenId:5, amount:6, withdrawToL1: 0, target:extendAddress(target) };
        const pubdata = getForcedExitPubdata(example);
        example.target = target;
        await testContract.testForcedExitPubdata(example, pubdata);
    });

    // ChangePubKey
    it('Correctly Parse ChangePubKey pubdata', async () => {
        const pubKeyHash = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        const owner = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';

        const example = { chainId:1, accountId:2, subAccountId:3, pubKeyHash, owner:extendAddress(owner), nonce:3, tokenId:4, fee:5 };
        const pubdata = getChangePubkeyPubdata(example);
        example.owner = owner;
        await testContract.testChangePubkeyPubdata(example, pubdata);
    });
});
