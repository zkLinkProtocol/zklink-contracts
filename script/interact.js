const fs = require('fs');
const { readDeployerKey } = require('./utils');
const { layerZero } = require('./layerzero');

async function governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr) {
    console.log('Adding new ERC20 token to network: ', tokenAddr);
    const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addToken(tokenId, tokenAddr);
    console.log('tx hash: ', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status) {
        console.log('tx success');
    } else {
        throw new Error(`failed add token to the governance`);
    }
}

async function governanceAddTokens(hardhat, governor, governanceAddr, tokenIdList, tokenAddrList) {
    const governanceFactory = await hardhat.ethers.getContractFactory('Governance');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addTokens(tokenIdList, tokenAddrList);
    console.log('tx hash: ', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status) {
        console.log('tx success');
    } else {
        throw new Error(`failed add tokens to the governance`);
    }
}

task("addToken", "Adds a new token with a given address for testnet")
    .addParam("governance", "The governance contract address, default get from deploy log", undefined, types.string, true)
    .addParam("tokenId", "The token id")
    .addParam("tokenAddress", "The token address")
    .setAction(async (taskArgs, hardhat) => {
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        let governanceAddr = taskArgs.governance;
        const tokenId = taskArgs.tokenId;
        const tokenAddr = taskArgs.tokenAddress;
        if (governanceAddr === undefined) {
            const deployLogPath = `log/deploy_${process.env.NET}.log`;
            const data = fs.readFileSync(deployLogPath, 'utf8');
            const deployLog = JSON.parse(data);
            governanceAddr = deployLog.governanceProxy;
        }
        console.log('governor', governor.address);
        console.log('governance', governanceAddr);
        console.log('token id', tokenId);
        console.log('token address', tokenAddr);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        await governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr);
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
        const tokenIdList = [];
        const tokenAddrList = [];
        for (const token of tokens) {
            tokenIdList.push(token.id);
            tokenAddrList.push(token.address);
        }
        console.log('token num: ', tokenIdList.length);
        await governanceAddTokens(hardhat, governor, governanceAddr, tokenIdList, tokenAddrList);
    });

task("depositERC20", "Deposit erc20 token to zkLink on testnet")
    .addParam("zklink", "The zklink proxy address")
    .addParam("token", "The token address")
    .addParam("decimals", "The token decimals", undefined, types.number, true)
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs, hardhat) => {
            const key = readDeployerKey();
            const sender = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
            const zkLinkProxy = taskArgs.zklink;
            const token = taskArgs.token;
            const decimals = taskArgs.decimals === undefined ? 18 : taskArgs.decimals;
            const amount = taskArgs.amount;
            console.log('zklink address', zkLinkProxy);
            console.log('token address', token);
            console.log('decimals', decimals);
            console.log('amount', amount);

            const balance = await sender.getBalance();
            console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));
            const erc20Factory = await hardhat.ethers.getContractFactory('ERC20');
            const erc20 = erc20Factory.attach(token);
            const tokenBalance = await erc20.connect(sender).balanceOf(sender.address);
            console.log('sender token balance', hardhat.ethers.utils.formatEther(tokenBalance, decimals));

            const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
            const zkLink = zkLinkFactory.attach(zkLinkProxy);
            const amountInWei = hardhat.ethers.utils.parseUnits(amount, decimals);
            const allowance = await erc20.connect(sender).allowance(sender.address, zkLink);
            if (allowance.isZero()) {
                    console.log('add unlimited allowance');
                    const tx = await erc20.connect(sender).approve(zkLink, hardhat.ethers.constants.MaxUint256);
                    console.log('approve tx hash', tx.hash);
            }
            const tx = await zkLink.connect(sender).depositERC20(token, amountInWei, sender.address, 0);
            console.log('tx', tx.hash);
    });

task("mintZKL", "Mint zkl for POLYGONTEST")
    .addParam("zkl", "The zkl contract address on POLYGONTEST")
    .addParam("account", "The account address")
    .addParam("amount", "The mint amount")
    .setAction(async (taskArgs, hardhat) => {
        const zklAddr = taskArgs.zkl;
        const accountAddr = taskArgs.account;
        const amount = hardhat.ethers.utils.parseEther(taskArgs.amount);
        if (process.env.NET !== 'POLYGONTEST') {
            console.log('only POLYGONTEST can mint zkl');
            return;
        }

        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const zklFactory = await hardhat.ethers.getContractFactory('ZKL');
        const zklContract = zklFactory.attach(zklAddr);

        console.log('Mint zkl...')
        const tx = await zklContract.connect(governor).mintTo(accountAddr, amount);
        console.log('tx', tx.hash);
    });

task("setDestination", "Set layerzero bridge destination for testnet")
    .addParam("bridge", "The src lz bridge contract address")
    .addParam("dstName", "The destination chain name: 'RINKEBY','GOERLI','AVAXTEST','POLYGONTEST'")
    .addParam("dstBridge", "The destination lz bridge contract address")
    .setAction(async (taskArgs, hardhat) => {
        const bridgeAddr = taskArgs.bridge;
        const dstChain = taskArgs.dstName;
        const dstBridgeAddr = taskArgs.dstBridge;
        const curChain = process.env.NET;
        if (curChain === dstChain) {
            console.log('invalid dst');
            return;
        }
        const lzInfo = layerZero[dstChain];
        if (lzInfo === undefined) {
            console.log('%s layerzero not support', dstChain);
            return;
        }
        const key = readDeployerKey();
        const governor = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        console.log('Set destination...')
        const tx = await bridgeContract.connect(governor).setDestination(lzInfo.chainId, dstBridgeAddr);
        console.log('tx', tx.hash);
    });

task("bridge", "Send zkl of deployer to another chain for testnet")
    .addParam("bridge", "The src lz bridge contract address")
    .addParam("dst", "The target destination network name: 'RINKEBY','GOERLI','AVAXTEST','POLYGONTEST'")
    .addParam("amount", "Amount to send")
    .setAction(async (taskArgs, hardhat) => {
        const bridgeAddr = taskArgs.bridge;
        const dstChain = taskArgs.dst;
        const amount = hardhat.ethers.utils.parseEther(taskArgs.amount);

        const curChain = process.env.NET;
        if (curChain === dstChain) {
            console.log('invalid dst');
            return;
        }

        const key = readDeployerKey();
        const deployer = new hardhat.ethers.Wallet(key, hardhat.ethers.provider);
        console.log('deployer', deployer.address);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        // layerzero must support dst chain
        const lzInfo = layerZero[dstChain];
        if (lzInfo === undefined) {
            console.log('%s layerzero not support', dstChain);
            return;
        }

        const feeInfo = await bridgeContract.connect(deployer)
            .estimateZKLBridgeFees(lzInfo.chainId, deployer.address, amount, false, "0x");
        const nativeFee = feeInfo.nativeFee;
        console.log('nativeFee', hardhat.ethers.utils.formatEther(nativeFee));
        const tx = await bridgeContract.connect(deployer)
            .bridgeZKL(deployer.address,
                lzInfo.chainId,
                deployer.address,
                amount,
                deployer.address,
                hardhat.ethers.constants.AddressZero,
                "0x",
                {value:nativeFee});
        console.log('tx', tx.hash);
    });
