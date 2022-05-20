const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('Bridge ZkLink block unit tests', function () {
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

        const zklinkFactory = await ethers.getContractFactory('ZkLinkTest');
        zklinkInETH = await zklinkFactory.deploy();
        await zklinkInETH.setGov(govInETH.address);
        zklinkInBSC = await zklinkFactory.deploy();
        await zklinkInBSC.setGov(govInBSC.address);

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

    it('only bridge can call receiveSynchronizationProgress', async () => {
        // Error: VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)
        await expect(zklinkInETH.connect(alice).receiveSynchronizationProgress('0xaabb000000000000000000000000000000000000000000000000000000000000', 1))
            .to.be.reverted;
    });

    it('estimateZkLinkBlockBridgeFees should success', async () => {
        const fees = await lzBridgeInETH.estimateZkLinkBlockBridgeFees(lzChainIdInBSC, false, "0x");
        expect(fees.nativeFee > 0);
    });

    it('bridge ZkLink block should success', async () => {
        const syncHash = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        const storedBlock = {
            "blockNumber":11,
            "priorityOperations":7,
            "pendingOnchainOperationsHash":"0xcf2ef9f8da5935a514cc25835ea39be68777a2674197105ca904600f26547ad2",
            "timestamp":1652422395,
            "stateHash":"0x6104d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "commitment":"0xff04d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "syncHash":syncHash,
        };
        await zklinkInETH.mockProveBlock(storedBlock);

        const fees = await lzBridgeInETH.estimateZkLinkBlockBridgeFees(lzChainIdInBSC, false, "0x");
        const lzParams = {
            "dstChainId": lzChainIdInBSC,
            "refundAddress": alice.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInETH.connect(alice).bridgeZkLinkBlock(storedBlock,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklinkInBSC, "ReceiveSynchronizationProgress")
            .withArgs(lzBridgeInBSC.address, lzChainIdInETH, 1, syncHash, 1);
    });

    it('test lz receive gas cost', async () => {
        const syncHash = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        const syncProgress = 15;
        const payload = ethers.utils.defaultAbiCoder.encode(["uint32","uint256"], [syncHash,syncProgress])
        const payloadWithType = ethers.utils.solidityPack(["uint8", "bytes"],[1, payload]);
        const nonce = 1;

        await expect(lzInETH.lzReceiveTest(lzChainIdInBSC,
            lzBridgeInBSC.address,
            lzBridgeInETH.address,
            nonce,
            payloadWithType))
            .to.be.emit(zklinkInETH, "ReceiveSynchronizationProgress")
            .withArgs(lzBridgeInETH.address, lzChainIdInBSC, nonce, syncHash, syncProgress);
    });
});
