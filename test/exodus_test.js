const hardhat = require('hardhat');
const { expect } = require('chai');
const { deploy } = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('ZkLink exodus unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, token3, token3Id, defaultSender, governance, governor;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        governance = deployedInfo.governance;
        governor = deployedInfo.governor;
    });

    it('active exodus should success', async () => {
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        const subAccountId = 0;
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(to, subAccountId, {value: amount});
        await zkLink.connect(defaultSender).setPriorityExpirationBlock(0, 1);
        await expect(zkLink.connect(defaultSender).activateExodusMode()).to.be.emit(zkLink, "ExodusMode");
        await expect(zkLink.connect(defaultSender).activateExodusMode()).to.be.revertedWith("Z0");
    });
});
