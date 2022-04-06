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

function getPartialExitPubdata({ chainId, accountId, tokenId, amount, fee, owner, nonce, isFastWithdraw, fastWithdrawFee }) {
    return ethers.utils.concat([
        ethers.utils.arrayify('0x03'),
        ethers.utils.arrayify(chainId),
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
    calFee
};
