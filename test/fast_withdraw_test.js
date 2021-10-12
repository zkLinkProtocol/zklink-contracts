const hardhat = require('hardhat');
const { expect } = require('chai');

describe('Fast withdraw unit tests', function () {
    let token, zkSync, zkSyncBlock, zkSyncExit, governance, vault;
    let wallet,alice,bob;
    beforeEach(async () => {
        [wallet,alice,bob] = await hardhat.ethers.getSigners();
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

    it('fast withdraw erc20 token should success', async () => {
        const opType = 3;
        const accountId = 1;
        const tokenId = 1;
        const fee = 0;
        const accepter = alice.address;
        const receiver = bob.address;
        const nonce = 134;

        let amount = hardhat.ethers.utils.parseEther("1000");
        let fastWithdrawFeeRatio = 30; // 0.3%
        let bobReceive = hardhat.ethers.utils.parseEther("997");
        let fastWithdrawFee = hardhat.ethers.utils.parseEther("3");

        await token.connect(alice).mint(amount);
        await token.connect(alice).approve(zkSync.address, amount);
        await expect(zkSyncExit.connect(alice).accept(accepter, receiver, tokenId, amount, fastWithdrawFeeRatio, nonce))
            .to.emit(zkSync, 'Accept')
            .withArgs(accepter, receiver, tokenId, bobReceive);
        expect(await token.balanceOf(receiver)).to.eq(bobReceive);

        const encodePubdata = hardhat.ethers.utils.solidityPack(["uint8","uint32","uint16","uint128","uint16","address","uint32","bool","uint16"],
            [opType,accountId,tokenId,amount,fee,receiver,nonce,true,fastWithdrawFeeRatio]);
        const pubdata = ethers.utils.arrayify(encodePubdata);
        await zkSyncBlock.testExecPartialExit(pubdata);
        expect(await zkSyncExit.getPendingBalance(accepter, token.address)).to.eq(amount);
    });
});
