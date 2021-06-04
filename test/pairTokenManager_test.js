const hardhat = require('hardhat');
const { expect } = require('chai');

const PAIR_TOKEN_START_ID = 128;

describe('PairTokenManager unit tests', function () {
    let testContract;
    before(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('PairTokenManagerTest');
        testContract = await contractFactory.deploy();
    });

    it('Add pair token should success', async () => {
        const token = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        await testContract.testAddPairToken(token);
        const totalPairTokens = await testContract.totalPairTokens();
        const tid = await testContract.tokenIds(token);
        const taddr = await testContract.tokenAddresses(tid);
        expect(totalPairTokens).equal(1);
        expect(tid).equal(PAIR_TOKEN_START_ID);
        expect(taddr).equal(token);

        await expect(testContract.testAddPairToken(token)).to.be.revertedWith('pan1');
    });

    it('Validate pair token address should success', async () => {
        const token = '0x823B747710C5bC9b8A47243f2c3d1805F1aA00c5';
        await testContract.validatePairTokenAddress(token);

        const tokenNotExist = '0x042147bd43d3f59b3133ee08322b67e4e9f2fdb3';
        await expect(testContract.validatePairTokenAddress(tokenNotExist)).to.be.revertedWith('pms3');
    });
});
