const {ChainContractDeployer} = require("./utils");
task("deployAccountMock", "Deploy eip1271 account mock for testnet")
    .addParam("owner", "The account owner", undefined, types.string, false)
    .addParam("pubkeyHash", "The new pubkey hash(20 bytes) that will be set to account", undefined, types.string, false)
    .addParam("saltArg", "The salt arg of create2 data", "0x0000000000000000000000000000000000000000000000000000000000000000", types.string, true)
    .setAction(async (taskArgs, hardhat) => {
        let owner = taskArgs.owner;
        let pubkeyHash = taskArgs.pubkeyHash;
        let saltArg = taskArgs.saltArg;

        console.log('owner', owner);
        console.log('pubkeyHash', pubkeyHash);
        console.log('saltArg', saltArg);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        // deploy AccountMockDeployer
        console.log('deploy AccountMockDeployer...');
        const accountMockDeployerContract = await contractDeployer.deployContract('AccountMockDeployer', []);
        console.log('account mock deployer deployed success: ', accountMockDeployerContract.address);

        // cal AccountMock code hash
        const accountMockFactory = await hardhat.ethers.getContractFactory("AccountMock");
        const accountMockCodeHash = hardhat.ethers.utils.solidityKeccak256(["bytes","bytes"], [
                accountMockFactory.bytecode,
                hardhat.ethers.utils.defaultAbiCoder.encode(["address"], [owner])
        ]);
        console.log('account mock code hash: ', accountMockCodeHash);

        // cal salt
        const salt = hardhat.ethers.utils.solidityKeccak256(["bytes"],[hardhat.ethers.utils.solidityPack(["bytes32","bytes20"], [saltArg, pubkeyHash])]);
        console.log('salt: ', salt);

        // deploy account mock
        await accountMockDeployerContract.connect(contractDeployer.deployerWallet).deployAccountMock(salt, owner);
        const accountMock = await accountMockDeployerContract.connect(contractDeployer.deployerWallet).am();
        console.log('account mock deploy success: ', accountMock);
});
