const fs = require('fs');
const { readDeployerKey } = require('./utils');

async function governanceAddToken(hardhat, governor, governanceAddr, tokenAddr, mappable) {
    console.log('Adding new ERC20 token to network: ', tokenAddr);
    const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addToken(tokenAddr, mappable);
    console.log('tx hash: ', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status) {
        console.log('tx success');
    } else {
        throw new Error(`failed add token to the governance`);
    }
}

task("addToken", "Adds a new token with a given address for testnet")
    .addParam("governance", "The governance contract address, default get from deploy log", undefined, types.string, true)
    .addParam("token", "The token address")
    .addParam("mappable", "The token is mappable? default is false", undefined, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let governanceAddr = taskArgs.governance;
        const tokenAddr = taskArgs.token;
        const mappable = taskArgs.mappable === undefined ? false : taskArgs.mappable;
        if (governanceAddr === undefined) {
            const deployLogPath = `log/deploy_${process.env.NET}.log`;
            const data = fs.readFileSync(deployLogPath, 'utf8');
            const deployLog = JSON.parse(data);
            governanceAddr = deployLog.governanceProxy;
        }
        console.log('governor', governor.address);
        console.log('governance', governanceAddr);
        console.log('token', tokenAddr);
        console.log('mappable', mappable);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        await governanceAddToken(hardhat, governor, governanceAddr, tokenAddr, mappable);
    });

task("addMultipleToken", "Adds multiple tokens for testnet")
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        const deployLogPath = `log/deploy_${process.env.NET}.log`;
        const data = fs.readFileSync(deployLogPath, 'utf8');
        const deployLog = JSON.parse(data);
        const governanceAddr = deployLog.governanceProxy;
        console.log('governor', governor.address);
        console.log('governance', governanceAddr);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const tokens = JSON.parse(fs.readFileSync(`etc/tokens/${process.env.NET}.json`, 'utf8'));
        for (const token of tokens) {
            await governanceAddToken(hardhat, governor, governanceAddr, token.address, token.mappable);
        }
    });

task("depositERC20", "Deposit erc20 token to zkLink on testnet")
    .addParam("zklink", "The zklink proxy address")
    .addParam("token", "The token address")
    .addParam("decimals", "The token decimals", undefined, types.number, true)
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs, hardhat) => {
            const key = readDeployerKey();
            const sender = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
            const zksync = taskArgs.zklink;
            const token = taskArgs.token;
            const decimals = taskArgs.decimals === undefined ? 18 : taskArgs.decimals;
            const amount = taskArgs.amount;
            console.log('zklink address', zksync);
            console.log('token address', token);
            console.log('decimals', decimals);
            console.log('amount', amount);

            const balance = await sender.getBalance();
            console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));
            const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
            const erc20 = erc20Factory.attach(token);
            const tokenBalance = await erc20.connect(sender).balanceOf(sender.address);
            console.log('sender token balance', hardhat.ethers.utils.formatEther(tokenBalance, decimals));

            const zkSyncFactory = await hardhat.ethers.getContractFactory('ZkLink');
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
