const { ethers } = require("hardhat");
const { expect } = require('chai');

describe('LayerZero bridge unit tests', function () {
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let deployer,networkGovernor,alice,lzBridgeInBSC,zklinkInETH,mockLzInETH;
    let lzInETH, lzBridgeInETH;
    before(async () => {
        [deployer,networkGovernor,alice,lzBridgeInBSC,zklinkInETH,mockLzInETH] = await ethers.getSigners();

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridgeMock');
        lzBridgeInETH = await lzBridgeFactory.deploy(networkGovernor.address, zklinkInETH.address, lzInETH.address);
    });

    it('only network governor can set destination', async () => {
        await expect(lzBridgeInETH.connect(alice).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.revertedWith('Caller is not governor');

        // can not set dst to the current chain
        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInBSC.address))
            .to.be.revertedWith('Invalid dstChainId');

        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.emit(lzBridgeInETH, "UpdateDestination")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase());
    });

    it('if lzReceive failed, message must be stored', async () => {
        await lzBridgeInETH.connect(networkGovernor).setEndpoint(mockLzInETH.address);
        const srcPath = ethers.utils.solidityPack(["address","address"],[lzBridgeInBSC.address,lzBridgeInETH.address]);
        await expect(lzBridgeInETH.connect(mockLzInETH).lzReceive(lzChainIdInBSC, srcPath, 1, "0x02"))
            .to.be.emit(lzBridgeInETH, "MessageFailed")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase(), 1, "0x02");

        await expect(lzBridgeInETH.retryMessage(lzChainIdInBSC, lzBridgeInBSC.address, 1, "0x02"))
            .to.be.reverted;
    });
});
