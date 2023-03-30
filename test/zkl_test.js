const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('ZKL unit tests', function () {
    let deployer,networkGovernor,alice,bob,tom;
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let govInETH, govInBSC, zklInETH, zklInBSC, lzInETH, lzInBSC, lzBridgeInETH, lzBridgeInBSC;
    before(async () => {
        [deployer,networkGovernor,alice,bob,tom] = await ethers.getSigners();

        const bmFactory = await ethers.getContractFactory('ZkLinkPeripheryTest');
        govInETH = await bmFactory.deploy();
        await govInETH.setGovernor(networkGovernor.address);
        govInBSC = await bmFactory.deploy();
        await govInBSC.setGovernor(networkGovernor.address);

        const zklFactory = await ethers.getContractFactory('ZKL');
        zklInETH = await zklFactory.deploy(govInETH.address);
        zklInBSC = await zklFactory.deploy(govInBSC.address);

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);
        lzInBSC = await dummyLZFactory.deploy(lzChainIdInBSC);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridgeMock');
        lzBridgeInETH = await upgrades.deployProxy(lzBridgeFactory, [networkGovernor.address, lzInETH.address], {kind: "uups"});
        lzBridgeInBSC = await upgrades.deployProxy(lzBridgeFactory, [networkGovernor.address, lzInBSC.address], {kind: "uups"});

        await lzInETH.setDestLzEndpoint(lzBridgeInBSC.address, lzInBSC.address);
        await lzInBSC.setDestLzEndpoint(lzBridgeInETH.address, lzInETH.address);

        govInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address);
        govInBSC.connect(networkGovernor).addBridge(lzBridgeInBSC.address);

        lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address);
        lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInETH.address);

        lzBridgeInETH.connect(networkGovernor).setApp(0, zklInETH.address);
        lzBridgeInBSC.connect(networkGovernor).setApp(0, zklInBSC.address)
    });

    it('only network governor can mint zkl', async () => {
        const amount = parseEther("1");
        await expect(zklInETH.connect(alice).mintTo(alice.address, amount))
            .to.be.revertedWith('Caller is not governor');

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
        await expect(zklInETH.connect(alice).bridgeTo(alice.address, alice.address, 2))
            .to.be.revertedWith("v");
        await expect(zklInETH.connect(alice).bridgeFrom(alice.address, 2))
            .to.be.revertedWith("v");
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
            .to.be.emit(lzBridgeInETH, "SendZKL")
            .withArgs(lzChainIdInBSC, 1, alice.address, alice.address.toLowerCase(), bridgeAmount);
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
            .to.be.emit(lzBridgeInBSC, "SendZKL")
            .withArgs(lzChainIdInETH, 1, alice.address, bob.address.toLowerCase(), bridgeAmount);
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
            .to.be.emit(lzBridgeInBSC, "SendZKL")
            .withArgs(lzChainIdInETH, 2, alice.address, bob.address.toLowerCase(), bridgeAmount);
        const b1InETH = await zklInETH.balanceOf(bob.address);
        const b1InBSC = await zklInBSC.balanceOf(alice.address);
        expect(b1InETH).eq(b0InETH.add(bridgeAmount));
        expect(b1InBSC).eq(b0InBSC.sub(bridgeAmount));
    });
});
