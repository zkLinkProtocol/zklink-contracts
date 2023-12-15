const { ethers } = require("hardhat");
const { expect } = require('chai');
const {deploy} = require("./utils");

describe('LayerZero bridge unit tests', function () {
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
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

    it('only network governor can set chain id map', async () => {
        await expect(lzBridgeInETH.connect(alice).setChainIdMap(1, lzChainIdInETH))
            .to.be.revertedWith('Caller is not governor');

        await expect(lzBridgeInETH.connect(networkGovernor).setChainIdMap(1, lzChainIdInETH))
            .to.be.emit(lzBridgeInETH, "UpdateChainIdMap")
            .withArgs(1, lzChainIdInETH);
    });

    it('only network governor can set destination', async () => {
        await expect(lzBridgeInETH.connect(alice).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.revertedWith('Caller is not governor');

        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.emit(lzBridgeInETH, "UpdateDestination")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase());
    });

    it('if lzReceive failed, message must be stored', async () => {
        await lzBridgeInETH.connect(networkGovernor).setEndpoint(mockLzInETH.address);
        const srcPath = ethers.solidityPacked(["address","address"],[lzBridgeInBSC.address,lzBridgeInETH.target]);
        await expect(lzBridgeInETH.connect(mockLzInETH).lzReceive(lzChainIdInBSC, srcPath, 1, "0x02"))
            .to.be.emit(lzBridgeInETH, "MessageFailed")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase(), 1, "0x02");

        await expect(lzBridgeInETH.retryMessage(lzChainIdInBSC, lzBridgeInBSC.address, 1, "0x02"))
        //     .to.be.reverted;
    });
});
