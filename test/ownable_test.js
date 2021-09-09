const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Ownable unit tests', function () {
    let testContract;
    let deployer;
    let wallet;
    before(async () => {
        [deployer, wallet] = await hardhat.ethers.getSigners();
        const contractFactory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/Ownable.sol:Ownable');
        testContract = await contractFactory.deploy(deployer.address);
    });

    it('checking correctness of setting mastership in constructor', async () => {
        expect(await testContract.getMaster()).to.equal(deployer.address);
    });

    it('checking correctness of transferring mastership to zero address', async () => {
        await expect(testContract.transferMastership('0x0000000000000000000000000000000000000000', { gasLimit: '300000' })).to.be.revertedWith('1d');
    });

    it('checking correctness of transferring mastership', async () => {
        /// transfer mastership to wallet
        await testContract.transferMastership(wallet.address);
        expect(await testContract.getMaster()).to.equal(wallet.address);

        /// try to transfer mastership to deployer by deployer call
        await expect(testContract.transferMastership(deployer.address, { gasLimit: '300000' })).to.be.revertedWith('1c');

        /// transfer mastership back to deployer
        let testContract_with_wallet2_signer = await testContract.connect(wallet);
        await testContract_with_wallet2_signer.transferMastership(deployer.address);
        expect(await testContract.getMaster()).to.equal(deployer.address);
    });
});
