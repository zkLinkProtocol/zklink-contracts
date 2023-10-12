const {ChainContractDeployer} = require("./utils");

task("deployFaucetToken", "Deploy faucet token for testnet")
    .addParam("name", "The token name", undefined, types.string, false)
    .addParam("symbol", "The token symbol", undefined, types.string, false)
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        let name = taskArgs.name;
        let symbol = taskArgs.symbol;
        let decimals = taskArgs.decimals;

        console.log('name', name);
        console.log('symbol', symbol);
        console.log('decimals', decimals);

        const contractDeployer = new ChainContractDeployer(hardhat);
        await contractDeployer.init();

        // deploy erc20 token
        console.log('deploy faucet token...');
        const deployArgs = [name, symbol, decimals];
        let tokenContract = await contractDeployer.deployContract('FaucetToken', deployArgs);
        console.log('token deploy success: ', tokenContract.address);
});
