const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Vault withdraw simulate tests', function () {
    let vaultWithdraw;
    beforeEach(async () => {
        const contractFactory = await hardhat.ethers.getContractFactory('VaultWithdrawTest');
        vaultWithdraw = await contractFactory.deploy();
    });

    context('token will not take fees', async() => {
        // balance of vault is enough to withdraw, no loss will produce
        it('case1 should success', async () => {
            await expect(vaultWithdraw.simulate(10, 10, 0, 11, 0, 0, 1))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(10, 0, 10);
        });

        // balance of vault is not enough to withdraw
        // strategy produce no loss
        // strategy return back token is just equal to withdrawNeeded
        it('case2 should success', async () => {
            await expect(vaultWithdraw.simulate(10, 10, 0, 8, 0, 10, 0))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(10, 0, 10);
        });

        // balance of vault is not enough to withdraw
        // strategy produce no loss
        // strategy return back token is smaller than withdrawNeeded
        it('case3 should success', async () => {
            await expect(vaultWithdraw.simulate(10, 10, 0, 8, 0, 9, 0)).to.be.revertedWith('Vault: withdraw goal not completed');
        });

        // balance of vault is not enough to withdraw
        // strategy produce no loss
        // strategy return back token is larger than withdrawNeeded
        it('case4 should success', async () => {
            await expect(vaultWithdraw.simulate(10, 10, 0, 8, 0, 9, 0)).to.be.revertedWith('Vault: withdraw goal not completed');
        });

        // balance of vault is not enough to withdraw
        // strategy produce loss
        // strategy return back token + loss is bigger or equal than withdrawNeeded
        // regardless loss
        it('case5 should success', async () => {
            await expect(vaultWithdraw.simulate(100000, 100000, 10000, 80000, 1000, 99034, 34))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(99000, 1000, 100000);
        });

        // balance of vault is not enough to withdraw
        // strategy produce loss
        // strategy return back token + loss is bigger or equal than withdrawNeeded
        // set max loss bip to 1%
        it('case6 should success', async () => {
            // withdrawNeeded = 20000
            // loss = 1010
            // balance added = 18990
            // loss bip = 1010*MAX_BPS/100000 = 101 > 100
            await expect(vaultWithdraw.simulate(100000, 100000, 100, 80000, 1010, 98990, 0)).to.be.revertedWith('Vault: over loss');

            /// withdrawNeeded = 20000
            // loss = 1000
            // balance added = 19000
            // loss bip = 1000*MAX_BPS/100000 = 100 <= 100
            await expect(vaultWithdraw.simulate(100000, 100000, 100, 80000, 1000, 99000, 0))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(99000, 1000, 100000);
        });
    })

    context('token will take fees', async() => {
        // balance of vault is enough to withdraw
        // loss is taken fees
        // regardless loss
        it('case7 should success', async () => {
            // taken fees = 2
            // not over maxAmount
            await expect(vaultWithdraw.simulate(10, 13, 10000, 20, 0, 0, 8))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(10, 2, 12);

            // taken fees = 4 so over maxAmount
            await expect(vaultWithdraw.simulate(10, 13, 10000, 20, 0, 0, 6)).to.be.revertedWith('Vault: over maxAmount');
        });

        // balance of vault is not enough to withdraw
        // strategy produce loss
        // strategy return back token + loss is bigger or equal than withdrawNeeded
        // loss contains taken fees
        // set max loss bip to 1%
        it('case8 should success', async () => {
            // withdrawNeeded = 20000
            // lossFromStrategy = 900
            // balance added = 29100(bigger than vault need)
            // taken fees = 200
            // loss bip = 1100*MAX_BPS/100000 = 110 > 100
            // not over maxAmount
            await expect(vaultWithdraw.simulate(100000, 200000, 100, 80000, 900, 109100, 9800)).to.be.revertedWith('Vault: over loss');

            // withdrawNeeded = 20000
            // lossFromStrategy = 900
            // balance added = 29100(bigger than vault need)
            // taken fees = 50
            // loss bip = 950*MAX_BPS/100000 = 95 < 100
            // over maxAmount
            await expect(vaultWithdraw.simulate(100000, 100049, 100, 80000, 900, 109100, 9950)).to.be.revertedWith('Vault: over maxAmount');

            // withdrawNeeded = 20000
            // lossFromStrategy = 900
            // balance added = 29100(bigger than vault need)
            // taken fees = 50
            // loss bip = 950*MAX_BPS/100000 = 95 < 100
            // not over maxAmount
            await expect(vaultWithdraw.simulate(100000, 100050, 100, 80000, 900, 109100, 9950))
                .to.emit(vaultWithdraw, 'Simulate')
                .withArgs(99100, 950, 100050);
        });
    })
});
