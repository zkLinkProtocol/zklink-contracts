const hardhat = require("hardhat");

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    const provider = new hardhat.ethers.providers.JsonRpcProvider("https://matic-mumbai.chainstacklabs.com");
    // it's a public mnemonic, don't use in product
    const mnemonic = "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol"
    const sender = hardhat.ethers.Wallet.fromMnemonic(mnemonic);
    console.log("sender: ", sender.address);
    // this tx will consume 1000 ether
    const result = await sender.connect(provider).sendTransaction({
        to: sender.address,
        value: 0,
        gasLimit: 10000000,
        gasPrice: 100000000000000,
    });
    console.log(result);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });