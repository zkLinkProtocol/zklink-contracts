task("deployFaucetToken", "Deploy faucet token for testnet")
    .addParam("name", "The token name", undefined, types.string, false)
    .addParam("symbol", "The token symbol", undefined, types.string, false)
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .addParam("fromTransferFeeRatio", "The fee ratio taken of from address when transfer", 0, types.int, true)
    .addParam("toTransferFeeRatio", "The fee ratio taken of to address when transfer", 0, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        const [deployer] = await hardhat.ethers.getSigners();
        let name = taskArgs.name;
        let symbol = taskArgs.symbol;
        let decimals = taskArgs.decimals;
        let fromTransferFeeRatio = taskArgs.fromTransferFeeRatio === undefined ? 0 : taskArgs.fromTransferFeeRatio;
        let toTransferFeeRatio = taskArgs.toTransferFeeRatio === undefined ? 0 : taskArgs.toTransferFeeRatio;

        console.log('deployer', deployer.address);
        console.log('name', name);
        console.log('symbol', symbol);
        console.log('decimals', decimals);
        console.log('fromTransferFeeRatio', fromTransferFeeRatio);
        console.log('toTransferFeeRatio', toTransferFeeRatio);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        // deploy erc20 token
        console.log('deploy faucet token...');
        const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
        const tokenContract = await tokenFactory.connect(deployer).deploy(name, symbol, decimals, fromTransferFeeRatio, toTransferFeeRatio);
        await tokenContract.deployed();
        console.log('token deploy success: ', tokenContract.address);
});
