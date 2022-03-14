const hardhat = require("hardhat");
const ethers = hardhat.ethers;

function getDepositPubdata({ chainId, accountId, tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function writeDepositPubdata({ chainId, tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'), // OpType.Deposit
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify('0x00000000'), // ignore accountId
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function getPartialExitPubdata({ accountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFee }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x03'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(fee),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(nonce),
        ethers.utils.arrayify(isFastWithdraw),
        ethers.utils.arrayify(fastWithdrawFee)
    ]);
}

function getFullExitPubdata({ chainId, accountId, owner, tokenId, amount}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x06'),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount)
    ]);
}

function getChangePubkeyPubdata({ accountId, pubKeyHash, owner, nonce}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x07'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(pubKeyHash),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(nonce)
    ]);
}

function getQuickSwapPubdata({fromChainId, toChainId, owner, fromTokenId, amountIn, to, toTokenId, amountOutMin, amountOut, nonce, pair, acceptTokenId, acceptAmountOutMin }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x0a'),
        ethers.utils.arrayify(fromChainId),
        ethers.utils.arrayify(toChainId),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(fromTokenId),
        ethers.utils.arrayify(amountIn),
        ethers.utils.arrayify(to),
        ethers.utils.arrayify(toTokenId),
        ethers.utils.arrayify(amountOutMin),
        ethers.utils.arrayify(amountOut),
        ethers.utils.arrayify(nonce),
        ethers.utils.arrayify(pair),
        ethers.utils.arrayify(acceptTokenId),
        ethers.utils.arrayify(acceptAmountOutMin)
    ]);
}

function getL1AddLQPubdata({ owner, chainId, tokenId, amount, pair, minLpAmount, lpAmount, nftTokenId }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x09'),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(pair),
        ethers.utils.arrayify(minLpAmount),
        ethers.utils.arrayify(lpAmount),
        ethers.utils.arrayify(nftTokenId)
    ]);
}

function getL1RemoveLQPubdata({ owner, chainId, tokenId, minAmount, amount, pair, lpAmount, nftTokenId }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x0b'),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(chainId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(minAmount),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(pair),
        ethers.utils.arrayify(lpAmount),
        ethers.utils.arrayify(nftTokenId)
    ]);
}

async function calFee(tx) {
    let gasPrice = tx.gasPrice;
    let txr = await ethers.provider.getTransactionReceipt(tx.hash);
    let gasUsed = txr.gasUsed;
    return ethers.BigNumber.from(gasPrice).mul(ethers.BigNumber.from(gasUsed));
}

module.exports = {
    getDepositPubdata,
    writeDepositPubdata,
    getPartialExitPubdata,
    getFullExitPubdata,
    getChangePubkeyPubdata,
    getQuickSwapPubdata,
    getL1AddLQPubdata,
    getL1RemoveLQPubdata,
    calFee
};
