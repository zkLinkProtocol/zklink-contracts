task("depositETH", "Deposit eth to zksync")
    .addParam("key", "The sender key", undefined, types.string, true)
    .addParam("zksync", "The zksync proxy address")
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs) => {
        const hardhat = require("hardhat");
        const key = taskArgs.key;
        const zksync = taskArgs.zksync;
        const amount = taskArgs.amount;
        console.log('zksync address', zksync);
        console.log('amount', amount);

        let sender;
        if (key === undefined) {
            [sender] = await hardhat.ethers.getSigners();
        } else {
            sender = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        }
        const balance = await sender.getBalance();
        console.log('sender balance', hardhat.ethers.utils.formatEther(balance));

        const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkSync');
        const zkSync = zkSyncFactory.attach(zksync);
        const tx = await zkSync.connect(sender).depositETH(sender.address, {value:hardhat.ethers.utils.parseUnits(amount)});
        console.log('tx hash', tx.hash);
});

task("depositERC20", "Deposit erc20 token to zksync")
    .addParam("key", "The sender key", undefined, types.string, true)
    .addParam("zksync", "The zksync proxy address")
    .addParam("token", "The token address")
    .addParam("decimals", "The token decimals", undefined, types.number, true)
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs) => {
            const hardhat = require("hardhat");
            const key = taskArgs.key;
            const zksync = taskArgs.zksync;
            const token = taskArgs.token;
            const decimals = taskArgs.decimals === undefined ? 18 : taskArgs.decimals;
            const amount = taskArgs.amount;
            console.log('zksync address', zksync);
            console.log('token address', token);
            console.log('decimals', decimals);
            console.log('amount', amount);

            let sender;
            if (key === undefined) {
                    [sender] = await hardhat.ethers.getSigners();
            } else {
                    sender = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
            }
            const balance = await sender.getBalance();
            console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));
            const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
            const erc20 = erc20Factory.attach(token);
            const tokenBalance = await erc20.connect(sender).balanceOf(sender.address);
            console.log('sender token balance', hardhat.ethers.utils.formatEther(tokenBalance, decimals));

            const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkSync');
            const zkSync = zkSyncFactory.attach(zksync);
            const amountInWei = hardhat.ethers.utils.parseUnits(amount, decimals);
            const allowance = await erc20.connect(sender).allowance(sender.address, zksync);
            if (allowance.isZero()) {
                    console.log('add unlimited allowance');
                    const tx = await erc20.connect(sender).approve(zksync, hardhat.ethers.constants.MaxUint256);
                    console.log('approve tx hash', tx.hash);
            }
            const tx = await zkSync.connect(sender).depositERC20(token, amountInWei, sender.address);
            console.log('tx', tx.hash);
    });
