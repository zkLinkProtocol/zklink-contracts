const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Accept unit tests', function () {
    let token, zkSync, zkSyncBlock, zkSyncExit, governance, vault;
    let wallet,alice,bob,broker;
    beforeEach(async () => {
        [wallet,alice,bob,broker] = await hardhat.ethers.getSigners();
        // token
        const erc20Factory = await hardhat.ethers.getContractFactory('cache/solpp-generated-contracts/dev-contracts/ERC20.sol:ERC20');
        token = await erc20Factory.deploy(10000);
        // governance, alice is networkGovernor
        const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
        governance = await governanceFactory.deploy();
        await governance.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [alice.address])
        );
        await governance.connect(alice).addToken(token.address, false); // tokenId = 1
        await governance.connect(alice).setValidator(bob.address, true); // set bob as validator
        // verifier
        const verifierFactory = await hardhat.ethers.getContractFactory('Verifier');
        const verifier = await verifierFactory.deploy();
        // Vault
        const vaultFactory = await hardhat.ethers.getContractFactory('Vault');
        vault = await vaultFactory.deploy();
        await vault.initialize(hardhat.ethers.utils.defaultAbiCoder.encode(['address'], [governance.address]));
        // ZkSync
        const contractFactory = await hardhat.ethers.getContractFactory('ZkSyncTest');
        zkSync = await contractFactory.deploy();
        // ZkSyncCommitBlock
        const zkSyncBlockFactory = await hardhat.ethers.getContractFactory('ZkSyncBlockTest');
        const zkSyncBlockRaw = await zkSyncBlockFactory.deploy();
        zkSyncBlock = zkSyncBlockFactory.attach(zkSync.address);
        // ZkSyncExit
        const zkSyncExitFactory = await hardhat.ethers.getContractFactory('ZkSyncExit');
        const zkSyncExitRaw = await zkSyncExitFactory.deploy();
        zkSyncExit = zkSyncExitFactory.attach(zkSync.address);
        await zkSync.initialize(
            hardhat.ethers.utils.defaultAbiCoder.encode(['address','address','address','address','address','bytes32'],
                [governance.address, verifier.address, vault.address, zkSyncBlockRaw.address, zkSyncExitRaw.address, hardhat.ethers.utils.arrayify("0x1b06adabb8022e89da0ddb78157da7c57a5b7356ccc9ad2f51475a4bb13970c6")])
        );
        await vault.setZkSyncAddress(zkSync.address);
    });

    it('broker approve should success', async () => {
        await zkSyncExit.connect(alice).brokerApprove(1, bob.address, 100);
        expect(await zkSyncExit.brokerAllowance(1, alice.address, bob.address)).to.eq(100);
    });

    it('erc20 accept should success when msg.sender is accepter', async () => {
        const tokenId = 1;
        let amount = hardhat.ethers.utils.parseEther("1000");
        let withdrawFee = 30; // 0.3%
        let bobReceive = hardhat.ethers.utils.parseEther("997");
        let fee = hardhat.ethers.utils.parseEther("3");
        const accepter = alice.address;
        const receiver = bob.address;
        let nonce = 1;

        await token.connect(alice).mint(amount);
        await token.connect(alice).approve(zkSync.address, amount);
        await expect(zkSyncExit.connect(alice).accept(accepter, receiver, tokenId, amount, withdrawFee, nonce))
            .to.emit(zkSync, 'Accept')
            .withArgs(accepter, receiver, tokenId, amount, fee, nonce);

        expect(await token.balanceOf(alice.address)).to.eq(fee);
        expect(await token.balanceOf(bob.address)).to.eq(bobReceive);

        // same accept will be rejected
        await expect(zkSyncExit.connect(alice).accept(accepter, receiver, tokenId, amount, withdrawFee, nonce))
            .to.be.revertedWith("ZkSync: accepted");
    });

    it('erc20 accept should success when msg.sender is not accepter', async () => {
        const tokenId = 1;
        let amount = hardhat.ethers.utils.parseEther("1000");
        let withdrawFee = 30; // 0.3%
        let bobReceive = hardhat.ethers.utils.parseEther("997");
        let fee = hardhat.ethers.utils.parseEther("3");
        const accepter = alice.address;
        const receiver = bob.address;
        let nonce = 1;

        await token.connect(alice).mint(amount);
        await token.connect(alice).approve(zkSync.address, amount);
        // no broker allowance
        await expect(zkSyncExit.connect(broker).accept(accepter, receiver, tokenId, amount, withdrawFee, nonce))
            .to.be.revertedWith("ZkSync: broker allowance");

        await zkSyncExit.connect(alice).brokerApprove(tokenId, broker.address, amount);
        await expect(zkSyncExit.connect(broker).accept(accepter, receiver, tokenId, amount, withdrawFee, nonce))
            .to.emit(zkSync, 'Accept')
            .withArgs(accepter, receiver, tokenId, amount, fee, nonce);

        expect(await token.balanceOf(alice.address)).to.eq(fee);
        expect(await token.balanceOf(bob.address)).to.eq(bobReceive);
        expect(await zkSyncExit.brokerAllowance(tokenId, alice.address, broker.address)).to.eq(fee);
    });
});
