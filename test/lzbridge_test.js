const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('LayerZero bridge unit tests', function () {
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let deployer,networkGovernor,alice,lzBridgeInBSC,zklInETH;
    let lzInETH, lzBridgeInETH;
    before(async () => {
        [deployer,networkGovernor,alice,lzBridgeInBSC,zklInETH] = await ethers.getSigners();

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);
        await lzInETH.setEstimatedFees(parseEther("0.001"), 0);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridge');
        lzBridgeInETH = await upgrades.deployProxy(lzBridgeFactory, [networkGovernor.address, lzInETH.address], {kind: "uups"});
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

    it('only network governor can set app', async () => {
        await expect(lzBridgeInETH.connect(alice).setApp(0, zklInETH.address))
            .to.be.revertedWith('Caller is not governor');

        await expect(lzBridgeInETH.connect(networkGovernor).setApp(0, zklInETH.address))
            .to.be.emit(lzBridgeInETH, "UpdateAPP")
            .withArgs(0, zklInETH.address);
    });

    it('if lzReceive failed, message must be stored', async () => {
        await expect(lzInETH.lzReceiveTest(lzChainIdInBSC, lzBridgeInBSC.address, lzBridgeInETH.address, 1, "0x02"))
            .to.be.emit(lzBridgeInETH, "MessageFailed")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase(), 1, "0x02");

        await expect(lzBridgeInETH.retryMessage(lzChainIdInBSC, lzBridgeInBSC.address, 1, "0x02"))
            .to.be.reverted;
    });

    it('upgrade bridge to new version should success', async () => {
        const lzBridgeFactoryV2 = await ethers.getContractFactory('LayerZeroBridgeV2Mock', networkGovernor);
        lzBridgeInETH = await upgrades.upgradeProxy(lzBridgeInETH.address, lzBridgeFactoryV2);
        expect(await lzBridgeInETH.version()).to.be.eq(2);
    });
});
