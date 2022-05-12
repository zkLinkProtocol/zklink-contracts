const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('Cross root hash unit tests', function () {
    let deployer,networkGovernor,alice,bob,tom;
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let govInETH, govInBSC, zklinkInETH, zklinkInBSC, lzInETH, lzInBSC, lzBridgeInETH, lzBridgeInBSC;
    before(async () => {
        [deployer,networkGovernor,alice,bob,tom] = await ethers.getSigners();

        const govFactory = await ethers.getContractFactory('Governance');
        govInETH = await govFactory.deploy();
        govInBSC = await govFactory.deploy();
        await govInETH.initialize(ethers.utils.defaultAbiCoder.encode(['address'], [networkGovernor.address]));
        await govInBSC.initialize(ethers.utils.defaultAbiCoder.encode(['address'], [networkGovernor.address]));

        const zklinkFactory = await ethers.getContractFactory('CrossRootHashTest');
        zklinkInETH = await zklinkFactory.deploy(govInETH.address);
        zklinkInBSC = await zklinkFactory.deploy(govInBSC.address);

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);
        lzInBSC = await dummyLZFactory.deploy(lzChainIdInBSC);
        await lzInETH.setEstimatedFees(parseEther("0.001"), 0);
        await lzInBSC.setEstimatedFees(parseEther("0.001"), 0);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridge');
        lzBridgeInETH = await upgrades.deployProxy(lzBridgeFactory, [govInETH.address, lzInETH.address], {kind: "uups"});
        lzBridgeInBSC = await upgrades.deployProxy(lzBridgeFactory, [govInBSC.address, lzInBSC.address], {kind: "uups"});

        await lzInETH.setDestLzEndpoint(lzBridgeInBSC.address, lzInBSC.address);
        await lzInBSC.setDestLzEndpoint(lzBridgeInETH.address, lzInETH.address);

        govInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address);
        govInBSC.connect(networkGovernor).addBridge(lzBridgeInBSC.address);

        lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address);
        lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInETH.address);

        lzBridgeInETH.connect(networkGovernor).setApp(1, zklinkInETH.address);
        lzBridgeInBSC.connect(networkGovernor).setApp(1, zklinkInBSC.address)
    });

    it('only bridge can call receiveCrossRootHash', async () => {
        // Error: VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)
        await expect(zklinkInETH.connect(alice).receiveCrossRootHash('0xaabb000000000000000000000000000000000000000000000000000000000000', 1))
            .to.be.reverted;
    });

    it('estimateRootHashBridgeFees should success', async () => {
        const fees = await lzBridgeInETH.estimateRootHashBridgeFees(lzChainIdInBSC, false, "0x");
        expect(fees.nativeFee > 0);
    });


    it('bridge root hash should success', async () => {
        const rh = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        await zklinkInETH.setTotalBlocksExecuted(10);
        await zklinkInETH.setTotalBlocksProven(20);
        await zklinkInETH.setBlockHash(11, rh);

        await zklinkInBSC.setTotalBlocksExecuted(100);
        await zklinkInBSC.setTotalBlocksProven(200);
        await zklinkInBSC.setBlockHash(150, rh);

        const fees = await lzBridgeInETH.estimateRootHashBridgeFees(lzChainIdInBSC, false, "0x");
        const lzParams = {
            "dstChainId": lzChainIdInBSC,
            "refundAddress": alice.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInETH.connect(alice).bridgeRootHash(11,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklinkInBSC, "ReceiveCrossRootHash")
            .withArgs(lzBridgeInBSC.address, lzChainIdInETH, 1, rh, 1);
    });

    it('test lz receive gas cost', async () => {
        const blockHash = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        const verifiedChains = 15;
        const payload = ethers.utils.defaultAbiCoder.encode(["uint32","uint256"], [blockHash,verifiedChains])
        const payloadWithType = ethers.utils.solidityPack(["uint8", "bytes"],[1, payload]);
        const nonce = 1;

        await expect(lzInETH.lzReceiveTest(lzChainIdInBSC,
            lzBridgeInBSC.address,
            lzBridgeInETH.address,
            nonce,
            payloadWithType))
            .to.be.emit(zklinkInETH, "ReceiveCrossRootHash")
            .withArgs(lzBridgeInETH.address, lzChainIdInBSC, nonce, blockHash, verifiedChains);
    });
});
