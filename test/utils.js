const hardhat = require("hardhat");
const ethers = hardhat.ethers;

function getDepositPubdata({ accountId, tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function writeDepositPubdata({ tokenId, amount, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'), // OpType.Deposit
        ethers.utils.arrayify('0x00000000'), // ignore accountId
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(owner)
    ]);
}

function getPartialExitPubdata({ accountId, tokenId, amount, fee, owner }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount),
        ethers.utils.arrayify(fee),
        ethers.utils.arrayify(owner)
    ]);
}

function getFullExitPubdata({ accountId, owner, tokenId, amount}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(tokenId),
        ethers.utils.arrayify(amount)
    ]);
}

function getChangePubkeyPubdata({ accountId, pubKeyHash, owner, nonce}) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(pubKeyHash),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(nonce)
    ]);
}

function getCreatePairPubdata({ accountId, tokenAId, tokenBId, tokenPairId, pair }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x01'),
        ethers.utils.arrayify(accountId),
        ethers.utils.arrayify(tokenAId),
        ethers.utils.arrayify(tokenBId),
        ethers.utils.arrayify(tokenPairId),
        ethers.utils.arrayify(pair)
    ]);
}

function getQuickSwapPubdata({fromChainId, toChainId, owner, fromTokenId, amountIn, to, toTokenId, amountOutMin, withdrawFee, nonce }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x0d'),
        ethers.utils.arrayify(fromChainId),
        ethers.utils.arrayify(toChainId),
        ethers.utils.arrayify(owner),
        ethers.utils.arrayify(fromTokenId),
        ethers.utils.arrayify(amountIn),
        ethers.utils.arrayify(to),
        ethers.utils.arrayify(toTokenId),
        ethers.utils.arrayify(amountOutMin),
        ethers.utils.arrayify(withdrawFee),
        ethers.utils.arrayify(nonce)
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
    getCreatePairPubdata,
    getQuickSwapPubdata,
    calFee
};
