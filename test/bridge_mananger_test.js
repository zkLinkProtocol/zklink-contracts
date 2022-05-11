const { ethers } = require("hardhat");
const { expect } = require('chai');

describe('Bridge manager unit tests', function () {
    let deployer,networkGovernor,alice,lzBridgeInETH;
    let bmInETH;
    before(async () => {
        [deployer,networkGovernor,alice,lzBridgeInETH] = await ethers.getSigners();

        const bmFactory = await ethers.getContractFactory('BridgeManager');
        bmInETH = await bmFactory.deploy();
        await bmInETH.transferOwnership(networkGovernor.address);
    });

    it('only network governor can add bridge', async () => {
        await expect(bmInETH.connect(alice).addBridge(lzBridgeInETH.address))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await expect(bmInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address))
            .to.be.emit(bmInETH, "AddBridge")
            .withArgs(lzBridgeInETH.address);
        // duplicate add bridge should failed
        await expect(bmInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address))
            .to.be.revertedWith("Bridge exist");
    });

    it('only network governor can disable bridge', async () => {
        await expect(bmInETH.connect(alice).updateBridge(1, false, false))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await expect(bmInETH.connect(networkGovernor).updateBridge(0, false, false))
            .to.be.emit(bmInETH, "UpdateBridge")
            .withArgs(0, false, false);

        await expect(bmInETH.connect(networkGovernor).updateBridge(0, true, true))
            .to.be.emit(bmInETH, "UpdateBridge")
            .withArgs(0, true, true);
    });
});
