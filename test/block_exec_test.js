const { expect } = require('chai');
const { deploy} = require('./utils');
const {parseEther} = require("ethers/lib/utils");

describe('Block exec unit tests', function () {
    let deployedInfo;
    let zkLink, ethId, token2, token2Id, token3, token3Id, defaultSender, alice, bob, governor, verifier;
    before(async () => {
        deployedInfo = await deploy();
        zkLink = deployedInfo.zkLink;
        ethId = deployedInfo.eth.tokenId;
        token2 = deployedInfo.token2.contract;
        token2Id = deployedInfo.token2.tokenId;
        token3 = deployedInfo.token3.contract;
        token3Id = deployedInfo.token3.tokenId;
        defaultSender = deployedInfo.defaultSender;
        alice = deployedInfo.alice;
        bob = deployedInfo.bob;
        governor = deployedInfo.governor;
        verifier = deployedInfo.verifier;
    });

    it('send eth no revert should be success', async () => {
        const b0 = await alice.getBalance();
        const amount = parseEther("1");
        await zkLink.connect(defaultSender).depositETH(defaultSender.address, ethId, {value: amount});
        await zkLink.connect(defaultSender).testSendETHNoRevert(alice.address, amount);
        const b1 = await alice.getBalance();
        expect(b1).to.be.eq(b0.add(amount));
    });
});
