const fs = require('fs');
const { readDeployerKey, readDeployContract } = require('./utils');
const { layerZero } = require('./layerzero');

async function governanceAddToken(hardhat, governor, governanceAddr, tokenAddr) {
    console.log('Adding new ERC20 token to network: ', tokenAddr);
    const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addToken(tokenAddr);
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
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let governanceAddr = taskArgs.governance;
        const tokenAddr = taskArgs.token;
        if (governanceAddr === undefined) {
            const deployLogPath = `log/deploy_${process.env.NET}.log`;
            const data = fs.readFileSync(deployLogPath, 'utf8');
            const deployLog = JSON.parse(data);
            governanceAddr = deployLog.governanceProxy;
        }
        console.log('governor', governor.address);
        console.log('governance', governanceAddr);
        console.log('token', tokenAddr);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        await governanceAddToken(hardhat, governor, governanceAddr, tokenAddr);
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
            await governanceAddToken(hardhat, governor, governanceAddr, token.address);
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

task("setDestination", "Set zkl multi chain destination for testnet")
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const totalChains = ['RINKEBY','GOERLI','AVAXTEST','POLYGONTEST'];
        const curChain = process.env.NET;
        if (!totalChains.includes(curChain)) {
            console.log('%s is not a testnet', curChain);
            return;
        }

        // cur chain zkl must exist
        const curZKL = readDeployContract(curChain, 'zkl');
        if (curZKL === undefined) {
            console.log('zkl must be deployed');
            return;
        }
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = zklFactory.attach(curZKL);

        const lzChains = [];
        const otherZKLs = [];
        for (const otherChain of totalChains) {
            if (otherChain === curChain) {
                continue;
            }
            const lzInfo = layerZero[otherChain];
            if (lzInfo === undefined) {
                console.log('%s layerzero not support', otherChain);
                continue;
            }
            const otherZKL = readDeployContract(otherChain, 'zkl');
            if (otherZKL === undefined) {
                console.log('%s zkl not exist', otherChain);
                continue;
            }
            lzChains.push(lzInfo.chainId);
            otherZKLs.push(otherZKL);
            console.log('prepare to set %s dst zkl address: %s', otherChain, otherZKL);
        }

        if (lzChains.length > 0) {
            const tx = await zklContract.connect(governor).setDestinations(lzChains, otherZKLs);
            console.log('tx', tx.hash);
        } else {
            console.log('no destinations can be set');
        }
    });

task("bridge", "Send zkl of deployer to another chain for testnet")
    .addParam("destination", "The target destination network name")
    .addParam("amount", "Amount to send")
    .setAction(async (taskArgs, hardhat) => {
        const dstChain = taskArgs.destination;
        const amount = taskArgs.amount;
        console.log('destination', dstChain);
        console.log('amount', amount);

        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        console.log('deployer', deployer.address);

        const balance = await deployer.getBalance();
        console.log('deployer eth balance', hardhat.ethers.utils.formatEther(balance));

        const totalChains = ['RINKEBY','GOERLI','AVAXTEST','POLYGONTEST'];
        const curChain = process.env.NET;
        if (!totalChains.includes(curChain)) {
            console.log('%s is not a testnet', curChain);
            return;
        }
        if (!totalChains.includes(dstChain)) {
            console.log('%s is not a testnet', dstChain);
            return;
        }
        if (dstChain === curChain) {
            console.log('can not bridge to the same chain');
            return;
        }

        // cur chain zkl must exist
        const curZKL = readDeployContract(curChain, 'zkl');
        if (curZKL === undefined) {
            console.log('zkl must be deployed');
            return;
        }
        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = zklFactory.attach(curZKL);
        const zklBalance = await zklContract.connect(deployer).balanceOf(deployer.address);
        console.log('deployer zkl balance', hardhat.ethers.utils.formatEther(zklBalance));

        // layerzero must support dst chain
        const lzInfo = layerZero[dstChain];
        if (lzInfo === undefined) {
            console.log('%s layerzero not support', dstChain);
            return;
        }

        const lzFee = hardhat.ethers.utils.parseEther("0.1");
        const tx = await zklContract.connect(deployer)
            .bridge(lzInfo.chainId, deployer.address, hardhat.ethers.utils.parseEther(amount), {value:lzFee});
        console.log('tx', tx.hash);
    });
