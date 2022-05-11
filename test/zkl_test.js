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

        bmInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address);
        bmInBSC.connect(networkGovernor).addBridge(lzBridgeInBSC.address);

        lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address);
        lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInETH.address);

        // lzBridgeInETH not set, test default is 20
        lzBridgeInBSC.connect(networkGovernor).setDestinationAddressLength(lzChainIdInETH, 20);

        lzBridgeInETH.connect(networkGovernor).setApp(0, zklInETH.address);
        lzBridgeInBSC.connect(networkGovernor).setApp(0, zklInBSC.address)
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

    it('only bridge can call bridgeTo and bridgeFrom', async () => {
        // Error: VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)
        await expect(zklInETH.connect(alice).bridgeTo(alice.address, alice.address, 2, "0x", 0, 0))
            .to.be.reverted;
        await expect(zklInETH.connect(alice).bridgeFrom(2, alice.address, 0, 0))
            .to.be.reverted;
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
        const lzParams = {
            "dstChainId": lzChainIdInBSC,
            "refundAddress": alice.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInETH.connect(alice).bridgeZKL(alice.address,
            alice.address,
            bridgeAmount,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklInETH, "BridgeTo")
            .withArgs(lzBridgeInETH.address, lzChainIdInBSC, 1, alice.address, alice.address.toLowerCase(), bridgeAmount);
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
        const lzParams = {
            "dstChainId": lzChainIdInETH,
            "refundAddress": alice.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInBSC.connect(alice).bridgeZKL(alice.address,
            bob.address,
            bridgeAmount,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklInBSC, "BridgeTo")
            .withArgs(lzBridgeInBSC.address, lzChainIdInETH, 1, alice.address, bob.address.toLowerCase(), bridgeAmount);
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
        const lzParams = {
            "dstChainId": lzChainIdInETH,
            "refundAddress": tom.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInBSC.connect(tom).bridgeZKL(alice.address,
            bob.address,
            bridgeAmount,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklInBSC, "BridgeTo")
            .withArgs(lzBridgeInBSC.address, lzChainIdInETH, 2, alice.address, bob.address.toLowerCase(), bridgeAmount);
        const b1InETH = await zklInETH.balanceOf(bob.address);
        const b1InBSC = await zklInBSC.balanceOf(alice.address);
        expect(b1InETH).eq(b0InETH.add(bridgeAmount));
        expect(b1InBSC).eq(b0InBSC.sub(bridgeAmount));
    });
});
