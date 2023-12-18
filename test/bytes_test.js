const hardhat = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');

describe('Bytes unit tests', function () {
    let testContract;
    before(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('BytesTest');
        testContract = await contractFactory.deploy();
    });

    // read

    it('should read bytes', async () => {
        let r = await testContract.read('0x0102030405060708', 4, 2);
        expect(r.data).equal('0x0506');
        expect(r.new_offset).equal(6);
    });

    it('should fail to read bytes beyond range', async () => {
        await expect(testContract.read('0x0102030405060708', 8, 2)).to.be.revertedWith('Z');
    });

    it('should fail to read too many bytes', async () => {
        await expect(testContract.read('0x0102030405060708', 4, 5)).to.be.revertedWith('Z');
    });

    // types

    it('should convert uint24', async () => {
        const x = "0x010203";
        let r = await testContract.testUInt24(x);
        expect(0x010203).equal(r.r);
        expect(r.offset).equal(3);
    });
});
