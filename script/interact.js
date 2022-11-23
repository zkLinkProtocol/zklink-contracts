const { readDeployContract, readDeployLogField} = require('./utils');
const { layerZero } = require('./layerzero');

async function governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr, tokenDecimals, standard) {
    console.log('Adding new ERC20 token to network: ', tokenAddr);
    const governanceFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
    const governance = governanceFactory.attach(governanceAddr);
    const tx = await governance.connect(governor).addToken(tokenId, tokenAddr, tokenDecimals, standard);
    console.log('tx hash: ', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status) {
        console.log('tx success');
    } else {
        throw new Error(`failed add token to the zkLink`);
    }
}

task("addToken", "Adds a new token with a given address for testnet")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("tokenId", "The token id")
    .addParam("tokenAddress", "The token address")
    .addParam("tokenDecimals", "The token decimals")
    .addParam("standard", "If the token is a standard erc20", true, types.boolean, true)
    .setAction(async (taskArgs, hardhat) => {
        const [governor] = await hardhat.ethers.getSigners();
        let governanceAddr = taskArgs.zkLink;
        if (governanceAddr === undefined) {
            governanceAddr = readDeployContract('deploy', 'zkLinkProxy');
        }
        const tokenId = taskArgs.tokenId;
        const tokenAddr = taskArgs.tokenAddress;
        const tokenDecimals = taskArgs.tokenDecimals;
        const standard = taskArgs.standard;
        console.log('governor', governor.address);
        console.log('zkLink', governanceAddr);
        console.log('token id', tokenId);
        console.log('token address', tokenAddr);
        console.log('token decimals', tokenDecimals);
        console.log('standard', standard);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        await governanceAddToken(hardhat, governor, governanceAddr, tokenId, tokenAddr, tokenDecimals, standard);
    });

task("depositERC20", "Deposit erc20 token to zkLink on testnet")
    .addParam("zklink", "The zklink proxy address")
    .addParam("token", "The token address")
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .addParam("amount", "The deposit amount in ether")
    .setAction(async (taskArgs, hardhat) => {
            const [sender] = await hardhat.ethers.getSigners();
            const zkLinkProxy = taskArgs.zklink;
            const token = taskArgs.token;
            const decimals = taskArgs.decimals;
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
            const tx = await zkLink.connect(sender).depositERC20(token, amountInWei, sender.address, 0, false);
            console.log('tx', tx.hash);
    });

task("setDestinations", "Set layerzero bridge destinations (only support testnet)")
    .setAction(async (taskArgs, hardhat) => {
        const bridgeAddr = readDeployContract('deploy_lz_bridge', 'lzBridgeProxy');
        const governorAddress = readDeployLogField('deploy_lz_bridge', 'governor');
        const governor = await hardhat.ethers.getSigner(governorAddress);

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        // fixme dstChains should not be constant
        const dstChains = ['RINKEBY','BSCTEST','AVAXTEST','POLYGONTEST'];
        for (let i = 0; i < dstChains.length; i++) {
            const dstChain = dstChains[i];
            if (process.env.NET === dstChain) {
                continue;
            }
            console.log('Set destination %s...', dstChain);
            const lzInfo = layerZero[dstChain];
            try {
                const dstBridgeAddr = readDeployContract('deploy_lz_bridge', 'lzBridgeProxy', dstChain);
                const tx = await bridgeContract.connect(governor).setDestination(lzInfo.chainId, dstBridgeAddr);
                console.log('tx', tx.hash);
            } catch (error) {
                console.log('Set bridge destination failed: ' + error);
            }
        }
    });

task("setApp", "Set layerzero supported app")
    .setAction(async (taskArgs, hardhat) => {
        const bridgeAddr = readDeployContract('deploy_lz_bridge', 'lzBridgeProxy');
        const governorAddress = readDeployLogField('deploy_lz_bridge', 'governor');
        const governor = await hardhat.ethers.getSigner(governorAddress);

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        try {
            const zklAddr = readDeployContract('deploy_zkl', 'zkl');
            console.log('Set zkl %s...', zklAddr);
            const tx = await bridgeContract.connect(governor).setApp(0, zklAddr);
            console.log('tx', tx.hash);
        } catch (error) {
            console.log('Set zkl failed: ' + error);
        }

        try {
            const zkLinkProxyAddr = readDeployContract('deploy', 'zkLinkProxy');
            console.log('Set zkLink %s...', zkLinkProxyAddr);
            const tx = await bridgeContract.connect(governor).setApp(1, zkLinkProxyAddr);
            console.log('tx', tx.hash);
        } catch (error) {
            console.log('Set zkLink failed: ' + error);
        }
    });

task("addBridge", "Add bridge to zkLink")
    .addParam("bridge", "The bridge address (default get from deploy log)", undefined, types.string, true)
    .setAction(async (taskArgs, hardhat) => {
        let bridgeAddr = taskArgs.bridge;
        if (bridgeAddr === undefined) {
            bridgeAddr = readDeployContract('deploy_lz_bridge', 'lzBridgeProxy');
        }

        const governorAddress = readDeployLogField('deploy', 'governor');
        const governor = await hardhat.ethers.getSigner(governorAddress);

        const zkLinkProxyAddr = readDeployContract('deploy', 'zkLinkProxy');

        console.log('bridge', bridgeAddr);
        console.log('governor', governor.address);
        console.log('zkLink', zkLinkProxyAddr);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const peripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const peripheryContract = peripheryFactory.attach(zkLinkProxyAddr);
        console.log('add bridge to zkLink...');
        const tx = await peripheryContract.connect(governor).addBridge(bridgeAddr);
        console.log('tx', tx.hash);
    });

task("mintFaucetToken", "Mint faucet token for testnet")
    .addParam("token", "The token contract address", undefined, types.string, false)
    .addParam("to", "The account address", undefined, types.string, false)
    .addParam("amount", "The mint amount", undefined, types.string, false)
    .addParam("decimals", "The token decimals", 18, types.int, true)
    .setAction(async (taskArgs, hardhat) => {
        let tokenAddr = taskArgs.token;
        const accountAddr = taskArgs.to;
        const amount = hardhat.ethers.utils.parseUnits(taskArgs.amount, taskArgs.decimals);
        console.log('to', accountAddr);
        console.log('amount', amount);

        const [governor] = await hardhat.ethers.getSigners();
        console.log('governor', governor.address);

        const balance = await governor.getBalance();
        console.log('governor balance', hardhat.ethers.utils.formatEther(balance));

        const tokenFactory = await hardhat.ethers.getContractFactory('FaucetToken');
        const tokenContract = tokenFactory.attach(tokenAddr);

        console.log('Mint token...')
        const tx = await tokenContract.connect(governor).mintTo(accountAddr, amount);
        console.log('tx', tx.hash);
    });

task("bridgeZKL", "Send zkl of deployer to another chain on testnet")
    .addParam("bridge", "The src lz bridge contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("dst", "The target destination network name: 'RINKEBY','GOERLI','AVAXTEST','POLYGONTEST'")
    .addParam("amount", "Amount to send")
    .setAction(async (taskArgs, hardhat) => {
        let bridgeAddr = taskArgs.bridge;
        if (bridgeAddr === undefined) {
            bridgeAddr = readDeployContract('deploy_lz_bridge', 'lzBridgeProxy');
        }
        const dstChain = taskArgs.dst;
        // layerzero must support dst chain
        const lzInfo = layerZero[dstChain];
        if (lzInfo === undefined) {
            console.log('%s layerzero not support', dstChain);
            return;
        }
        const amount = hardhat.ethers.utils.parseEther(taskArgs.amount);

        const curChain = process.env.NET;
        if (curChain === dstChain) {
            console.log('invalid dst');
            return;
        }

        const [deployer] = await hardhat.ethers.getSigners();
        console.log('deployer', deployer.address);

        const balance = await deployer.getBalance();
        console.log('deployer balance', hardhat.ethers.utils.formatEther(balance));

        const bridgeFactory = await hardhat.ethers.getContractFactory('LayerZeroBridge');
        const bridgeContract = bridgeFactory.attach(bridgeAddr);

        const feeInfo = await bridgeContract.connect(deployer)
            .estimateZKLBridgeFees(lzInfo.chainId, deployer.address, amount, false, "0x");
        const nativeFee = feeInfo.nativeFee;
        console.log('nativeFee', hardhat.ethers.utils.formatEther(nativeFee));
        const lzParams = {
            "dstChainId": lzInfo.chainId,
            "refundAddress": deployer.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        const tx = await bridgeContract.connect(deployer)
            .bridgeZKL(deployer.address,
                deployer.address,
                amount,
                lzParams,
                {value:nativeFee});
        console.log('tx', tx.hash);
    });

task("setAuthPubkeyHash", "Set auth pubkey hash for ChangePubKey on devnet or testnet")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("address", "The account address")
    .addParam("pubkeyHash", "The new pubkey hash that will be set to account")
    .addParam("nonce", "The account latest nonce")
    .setAction(async (taskArgs, hardhat) => {
        let zkLinkProxy = taskArgs.zkLink;
        if (zkLinkProxy === undefined) {
            zkLinkProxy = readDeployContract('deploy', 'zkLinkProxy');
        }
        const address = taskArgs.address;
        const pubkeyHash = taskArgs.pubkeyHash;
        const nonce = taskArgs.nonce;
        console.log('zkLink', zkLinkProxy);
        console.log('address', address);
        console.log('pubkeyHash', pubkeyHash);
        console.log('nonce', nonce);

        const sender = await hardhat.ethers.getSigner(address);

        const balance = await sender.getBalance();
        console.log('sender eth balance', hardhat.ethers.utils.formatEther(balance));

        const zkLinkPeripheryFactory = await hardhat.ethers.getContractFactory('ZkLinkPeriphery');
        const zkLink = zkLinkPeripheryFactory.attach(zkLinkProxy);
        const tx = await zkLink.connect(sender).setAuthPubkeyHash(pubkeyHash, nonce);
        console.log('tx', tx.hash);
    });

task("zkLinkStatus", "Query zkLink status")
    .addParam("zkLink", "The zkLink contract address (default get from deploy log)", undefined, types.string, true)
    .addParam("property", "The zkLink property", undefined, types.string, false)
    .setAction(async (taskArgs, hardhat) => {
        let zkLinkProxy = taskArgs.zkLink;
        let property = taskArgs.property;
        if (zkLinkProxy === undefined) {
            zkLinkProxy = readDeployContract('deploy', 'zkLinkProxy');
        }
        console.log('zkLink', zkLinkProxy);
        console.log('property', property);

        const zkLinkFactory = await hardhat.ethers.getContractFactory('ZkLink');
        const zkLink = zkLinkFactory.attach(zkLinkProxy);
        const result = await zkLink[property]();
        console.log('result:%s', result);
    });