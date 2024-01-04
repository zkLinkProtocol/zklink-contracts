const { ethers } = require("hardhat");
const { expect } = require('chai');
const {deploy} = require("./utils");

describe('LayerZero bridge unit tests', function () {
    const lzChainIdInETH = 101;
    const lzChainIdInBSC = 202;
    const zkLinkChainIdInBSC = 3;
    let networkGovernor,alice,lzBridgeInBSC,zklinkInETH,mockLzInETH;
    let lzInETH, lzBridgeInETH;
    before(async () => {
        [alice,lzBridgeInBSC,mockLzInETH] = await ethers.getSigners();

        let deployedInfo = await deploy();
        zklinkInETH = deployedInfo.zkLink;
        networkGovernor = deployedInfo.governor;

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridgeMock');
        lzBridgeInETH = await lzBridgeFactory.deploy(zklinkInETH.target, lzInETH.target);
    });

    it('only network governor can set destination', async () => {
        await expect(lzBridgeInETH.connect(alice).setDestination(zkLinkChainIdInBSC, lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.revertedWith('Caller is not governor');

        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(zkLinkChainIdInBSC, lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.emit(lzBridgeInETH, "UpdateDestination")
            .withArgs(zkLinkChainIdInBSC, lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase());
    });

    it('if lzReceive failed, message must be stored', async () => {
        await lzBridgeInETH.connect(networkGovernor).setEndpoint(mockLzInETH.address);
        const srcPath = ethers.solidityPacked(["address","address"],[lzBridgeInBSC.address,lzBridgeInETH.target]);
        const nonce = 1;
        const invalidPayload = "0x02";
        await expect(lzBridgeInETH.connect(mockLzInETH).lzReceive(lzChainIdInBSC, srcPath, nonce, invalidPayload))
            .to.be.emit(lzBridgeInETH, "MessageFailed")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase(), nonce, invalidPayload);
    });
});
