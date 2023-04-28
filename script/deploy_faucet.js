const {ChainContractDeployer} = require("./utils");

task("deployFaucetToken", "Deploy faucet token for testnet")
    .addParam("name", "The token name", undefined, types.string, false)
    .addParam("symbol", "The token symbol", undefined, types.string, false)
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .addParam("fromTransferFeeRatio", "The fee ratio taken of from address when transfer", 0, types.int, true)
    .addParam("toTransferFeeRatio", "The fee ratio taken of to address when transfer", 0, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        let name = taskArgs.name;
        let symbol = taskArgs.symbol;
        let decimals = taskArgs.decimals;
        let fromTransferFeeRatio = taskArgs.fromTransferFeeRatio === undefined ? 0 : taskArgs.fromTransferFeeRatio;
        let toTransferFeeRatio = taskArgs.toTransferFeeRatio === undefined ? 0 : taskArgs.toTransferFeeRatio;

        console.log('name', name);
        console.log('symbol', symbol);
        console.log('decimals', decimals);
        console.log('fromTransferFeeRatio', fromTransferFeeRatio);
        console.log('toTransferFeeRatio', toTransferFeeRatio);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        // deploy erc20 token
        console.log('deploy faucet token...');
        const deployArgs = [name, symbol, decimals, fromTransferFeeRatio, toTransferFeeRatio];
        let tokenContract = await contractDeployer.deployContract('FaucetToken', deployArgs);
        console.log('token deploy success: ', tokenContract.address);
});
