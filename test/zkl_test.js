const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('ZKL unit tests', function () {
    let deployer,networkGovernor,alice,bob,tom;
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let bmInETH, bmInBSC, zklInETH, zklInBSC, lzInETH, lzInBSC, lzBridgeInETH, lzBridgeInBSC;
    before(async () => {
        [deployer,networkGovernor,alice,bob,tom] = await ethers.getSigners();

        const bmFactory = await ethers.getContractFactory('BridgeManager');
        bmInETH = await bmFactory.deploy();
        bmInBSC = await bmFactory.deploy();

        const zklFactory = await ethers.getContractFactory('ZKL');
        zklInETH = await zklFactory.deploy(bmInETH.address);
        zklInBSC = await zklFactory.deploy(bmInBSC.address);

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);
        lzInBSC = await dummyLZFactory.deploy(lzChainIdInBSC);
        await lzInETH.setEstimatedFees(parseEther("0.001"), 0);
        await lzInBSC.setEstimatedFees(parseEther("0.001"), 0);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridge');
        lzBridgeInETH = await upgrades.deployProxy(lzBridgeFactory, [lzInETH.address], {kind: "uups"});
        lzBridgeInBSC = await upgrades.deployProxy(lzBridgeFactory, [lzInBSC.address], {kind: "uups"});

        await lzInETH.setDestLzEndpoint(lzBridgeInBSC.address, lzInBSC.address);
        await lzInBSC.setDestLzEndpoint(lzBridgeInETH.address, lzInETH.address);

        await bmInETH.transferOwnership(networkGovernor.address);
        await bmInBSC.transferOwnership(networkGovernor.address);
        await zklInETH.transferOwnership(networkGovernor.address);
        await zklInBSC.transferOwnership(networkGovernor.address);
        await lzBridgeInETH.transferOwnership(networkGovernor.address);
        await lzBridgeInBSC.transferOwnership(networkGovernor.address);
    });

    it('only network governor can mint zkl', async () => {
        const amount = parseEther("1");
        await expect(zklInETH.connect(alice).mintTo(alice.address, amount))
            .to.be.revertedWith('Ownable: caller is not the owner');

        const b0 = await zklInETH.balanceOf(alice.address);
        await zklInETH.connect(networkGovernor).mintTo(alice.address, amount);
        const b1 = await zklInETH.balanceOf(alice.address);
        expect(b1).to.be.eq(b0.add(amount));
    });

    it('mint exceed cap should be failed', async () => {
        const amount = parseEther("1000000000");
        await expect(zklInETH.connect(networkGovernor).mintTo(alice.address, amount))
            .to.be.revertedWith('ERC20Capped: cap exceeded');
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

        await expect(bmInBSC.connect(networkGovernor).addBridge(lzBridgeInBSC.address))
            .to.be.emit(bmInBSC, "AddBridge")
            .withArgs(lzBridgeInBSC.address);
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

    it('only bridge can call bridgeTo and bridgeFrom', async () => {
        await expect(zklInETH.connect(alice).bridgeTo(alice.address, alice.address, 2, "0x", 0, 0))
            .to.be.reverted;
        await expect(zklInETH.connect(alice).bridgeFrom(2, alice.address, 0, 0))
            .to.be.reverted;
    });

    it('only network governor can set bridge destination', async () => {
        await expect(lzBridgeInETH.connect(alice).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.revertedWith('Ownable: caller is not the owner');

        // can not set dst to the current chain
        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInBSC.address))
            .to.be.revertedWith('Invalid dstChainId');
        await expect(lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInETH.address))
            .to.be.revertedWith('Invalid dstChainId');

        await expect(lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address))
            .to.be.emit(lzBridgeInETH, "UpdateDestination")
            .withArgs(lzChainIdInBSC, lzBridgeInBSC.address.toLowerCase());

        await expect(lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInETH.address))
            .to.be.emit(lzBridgeInBSC, "UpdateDestination")
            .withArgs(lzChainIdInETH, lzBridgeInETH.address.toLowerCase());
    });

    it('only network governor can set bridge destination address length', async () => {
        await expect(lzBridgeInETH.connect(alice).setDestinationAddressLength(lzChainIdInBSC, 20))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await expect(lzBridgeInBSC.connect(networkGovernor).setDestinationAddressLength(lzChainIdInETH, 20))
            .to.be.emit(lzBridgeInBSC, "UpdateDestinationAddressLength")
            .withArgs(lzChainIdInETH, 20);
    });

    it('only network governor can set bridge app', async () => {
        await expect(lzBridgeInETH.connect(alice).setApp(0, zklInETH.address))
            .to.be.revertedWith('Ownable: caller is not the owner');

        await expect(lzBridgeInETH.connect(networkGovernor).setApp(0, zklInETH.address))
            .to.be.emit(lzBridgeInETH, "UpdateAPP")
            .withArgs(0, zklInETH.address);

        await expect(lzBridgeInBSC.connect(networkGovernor).setApp(0, zklInBSC.address))
            .to.be.emit(lzBridgeInBSC, "UpdateAPP")
            .withArgs(0, zklInBSC.address);
    });

    it('estimateZKLBridgeFees should success', async () => {
        const fees = await lzBridgeInETH.estimateZKLBridgeFees(lzChainIdInBSC, alice.address, parseEther("1"), false, "0x");
        expect(fees.nativeFee > 0);
    });


    it('bridge zkl to the same address should success', async () => {
        const b0InETH = await zklInETH.balanceOf(alice.address);
        const b0InBSC = await zklInBSC.balanceOf(alice.address);
        const bridgeAmount = parseEther("0.5");
        const fees = await lzBridgeInETH.estimateZKLBridgeFees(lzChainIdInBSC,
            alice.address,
            bridgeAmount,
            false,
            "0x");
        await expect(lzBridgeInETH.connect(alice).bridgeZKL(alice.address,
            lzChainIdInBSC,
            alice.address,
            bridgeAmount,
            alice.address,
            ethers.constants.AddressZero,
            "0x", {value: fees.nativeFee}))
            .to.be.emit(zklInETH, "BridgeTo")
            .withArgs(lzBridgeInETH.address, alice.address, lzChainIdInBSC, alice.address.toLowerCase(), bridgeAmount, 1);
        const b1InETH = await zklInETH.balanceOf(alice.address);
        const b1InBSC = await zklInBSC.balanceOf(alice.address);
        expect(b1InETH).eq(b0InETH.sub(bridgeAmount));
        expect(b1InBSC).eq(b0InBSC.add(bridgeAmount));
    });

    it('bridge zkl to different address should success', async () => {
        const b0InETH = await zklInETH.balanceOf(bob.address);
        const b0InBSC = await zklInBSC.balanceOf(alice.address);
        const bridgeAmount = parseEther("0.1");
        const fees = await lzBridgeInBSC.estimateZKLBridgeFees(lzChainIdInETH,
            bob.address,
            bridgeAmount,
            false,
            "0x");
        await expect(lzBridgeInBSC.connect(alice).bridgeZKL(alice.address,
            lzChainIdInETH,
            bob.address,
            bridgeAmount,
            alice.address,
            ethers.constants.AddressZero,
            "0x", {value: fees.nativeFee}))
            .to.be.emit(zklInBSC, "BridgeTo")
            .withArgs(lzBridgeInBSC.address, alice.address, lzChainIdInETH, bob.address.toLowerCase(), bridgeAmount, 1);
        const b1InETH = await zklInETH.balanceOf(bob.address);
        const b1InBSC = await zklInBSC.balanceOf(alice.address);
        expect(b1InETH).eq(b0InETH.add(bridgeAmount));
        expect(b1InBSC).eq(b0InBSC.sub(bridgeAmount));
    });

    it('spender(diff with from) bridge zkl should success', async () => {
        const b0InETH = await zklInETH.balanceOf(bob.address);
        const b0InBSC = await zklInBSC.balanceOf(alice.address);
        const bridgeAmount = parseEther("0.1");
        await zklInBSC.connect(alice).approve(tom.address, bridgeAmount);
        const fees = await lzBridgeInBSC.estimateZKLBridgeFees(lzChainIdInETH,
            bob.address,
            bridgeAmount,
            false,
            "0x");
        await expect(lzBridgeInBSC.connect(tom).bridgeZKL(alice.address,
            lzChainIdInETH,
            bob.address,
            bridgeAmount,
            tom.address,
            ethers.constants.AddressZero,
            "0x", {value: fees.nativeFee}))
            .to.be.emit(zklInBSC, "BridgeTo")
            .withArgs(lzBridgeInBSC.address, alice.address, lzChainIdInETH, bob.address.toLowerCase(), bridgeAmount, 2);
        const b1InETH = await zklInETH.balanceOf(bob.address);
        const b1InBSC = await zklInBSC.balanceOf(alice.address);
        expect(b1InETH).eq(b0InETH.add(bridgeAmount));
        expect(b1InBSC).eq(b0InBSC.sub(bridgeAmount));
    });

    it('upgrade bridge to new version should success', async () => {
        const lzBridgeFactoryV2 = await ethers.getContractFactory('LayerZeroBridgeV2Mock', networkGovernor);
        lzBridgeInETH = await upgrades.upgradeProxy(lzBridgeInETH.address, lzBridgeFactoryV2);
        expect(await lzBridgeInETH.version()).to.be.eq(2);
    });
});
