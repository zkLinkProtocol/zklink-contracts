const { ethers } = require("hardhat");
const { expect } = require('chai');
const {CHAIN_ID_INDEX,ALL_CHAINS} = require("./utils");
const {BigNumber} = require("ethers");

describe('Bridge ZkLink block unit tests', function () {
    let deployer,networkGovernor,alice,bob,evilBridge;
    const lzChainIdInETH = 1;
    const lzChainIdInBSC = 2;
    let zklinkInETH, zklinkInBSC, lzInETH, lzInBSC, lzBridgeInETH, lzBridgeInBSC;
    before(async () => {
        [deployer,networkGovernor,alice,bob,evilBridge] = await ethers.getSigners();

        const zklinkFactory = await ethers.getContractFactory('ZkLinkPeripheryTest');
        zklinkInETH = await zklinkFactory.deploy();
        await zklinkInETH.setGovernor(networkGovernor.address);
        zklinkInBSC = await zklinkFactory.deploy();
        await zklinkInBSC.setGovernor(networkGovernor.address);

        const dummyLZFactory = await ethers.getContractFactory('LZEndpointMock');
        lzInETH = await dummyLZFactory.deploy(lzChainIdInETH);
        lzInBSC = await dummyLZFactory.deploy(lzChainIdInBSC);

        const lzBridgeFactory = await ethers.getContractFactory('LayerZeroBridgeMock');
        lzBridgeInETH = await lzBridgeFactory.deploy(zklinkInETH.address, lzInETH.address);
        lzBridgeInBSC = await lzBridgeFactory.deploy(zklinkInBSC.address, lzInBSC.address);

        await lzInETH.setDestLzEndpoint(lzBridgeInBSC.address, lzInBSC.address);
        await lzInBSC.setDestLzEndpoint(lzBridgeInETH.address, lzInETH.address);

        zklinkInETH.connect(networkGovernor).addBridge(lzBridgeInETH.address);
        zklinkInBSC.connect(networkGovernor).addBridge(lzBridgeInBSC.address);

        lzBridgeInETH.connect(networkGovernor).setDestination(lzChainIdInBSC, lzBridgeInBSC.address);
        lzBridgeInBSC.connect(networkGovernor).setDestination(lzChainIdInETH, lzBridgeInETH.address);
    });

    it('only bridge can call receiveSynchronizationProgress', async () => {
        await expect(zklinkInETH.connect(alice).receiveSynchronizationProgress('0xaabb000000000000000000000000000000000000000000000000000000000000', 1))
            .to.be.revertedWithPanic(0x11);
    });

    it('estimateZkLinkBlockBridgeFees should success', async () => {
        const syncHash = "0x2caa921b22452d6ee16dbcc1a6987ee40f5dcf467ed45de3be9094ff482a31ad";
        const progress = 2;
        const fees = await lzBridgeInETH.estimateZkLinkBlockBridgeFees(lzChainIdInBSC, syncHash, progress, false, "0x");
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

        const fees = await lzBridgeInETH.estimateZkLinkBlockBridgeFees(lzChainIdInBSC, syncHash, 1, false, "0x");
        await expect(lzBridgeInETH.connect(alice).bridgeZkLinkBlock(
            storedBlock,
            [lzChainIdInBSC],
            alice.address,
            ethers.constants.AddressZero,
            "0x",
            {value: fees.nativeFee}))
            .to.be.emit(lzBridgeInBSC, "ReceiveSynchronizationProgress")
            .withArgs(lzChainIdInETH, 1, syncHash, 1);
    });

    it('evil bridge should has no impact to local progress', async () => {
        const syncHash = '0x00000000000000000000000000000000000000000000000000000000000000bb';
        const storedBlock = {
            "blockNumber":12,
            "priorityOperations":7,
            "pendingOnchainOperationsHash":"0xcf2ef9f8da5935a514cc25835ea39be68777a2674197105ca904600f26547ad2",
            "timestamp":1652422395,
            "stateHash":"0x6104d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "commitment":"0xff04d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "syncHash":syncHash,
        };

        await zklinkInETH.connect(networkGovernor).addBridge(evilBridge.address);
        // mock evil bridge deliver fake progress
        await zklinkInETH.connect(evilBridge).receiveSynchronizationProgress(syncHash,ALL_CHAINS);
        const progress = ALL_CHAINS & ~CHAIN_ID_INDEX;
        expect(await zklinkInETH.getSynchronizedProgress(storedBlock)).to.be.eq(progress);
    });

    it('multiple bridge ZkLink block should success', async () => {
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

        const fees = await lzBridgeInETH.estimateZkLinkBlockBridgeFees(lzChainIdInBSC, syncHash, 1, false, "0x");
        await expect(lzBridgeInETH.connect(alice).bridgeZkLinkBlock(
            storedBlock,
            [lzChainIdInBSC, lzChainIdInBSC], // mock duplicate bridge
            alice.address,
            ethers.constants.AddressZero,
            "0x",
            {value: fees.nativeFee})) // fee is not enough
            .to.be.revertedWith("LayerZeroMock: not enough native for fees");

        await expect(lzBridgeInETH.connect(alice).bridgeZkLinkBlock(
            storedBlock,
            [lzChainIdInBSC, lzChainIdInBSC], // mock duplicate bridge
            alice.address,
            ethers.constants.AddressZero,
            "0x",
            {value: fees.nativeFee.mul(BigNumber.from("2"))})) // fee is enough
            .to.be.emit(lzBridgeInBSC, "ReceiveSynchronizationProgress")
            .withArgs(lzChainIdInETH, 3, syncHash, 1); // lz outbound nonce increase from 1 to 3
    });
});
