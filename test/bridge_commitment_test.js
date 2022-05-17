const { ethers, upgrades } = require("hardhat");
const { expect } = require('chai');
const {parseEther} = require("ethers/lib/utils");

describe('Bridge commitment unit tests', function () {
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

    it('only bridge can call receiveCommitment', async () => {
        // Error: VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)
        await expect(zklinkInETH.connect(alice).receiveCommitment('0xaabb000000000000000000000000000000000000000000000000000000000000', 1))
            .to.be.reverted;
    });

    it('estimateCommitmentBridgeFees should success', async () => {
        const fees = await lzBridgeInETH.estimateCommitmentBridgeFees(lzChainIdInBSC, false, "0x");
        expect(fees.nativeFee > 0);
    });

    it('bridge commitment should success', async () => {
        const commitment = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        const storedBlock = {
            "blockNumber":11,
            "priorityOperations":7,
            "pendingOnchainOperationsHash":"0xcf2ef9f8da5935a514cc25835ea39be68777a2674197105ca904600f26547ad2",
            "timestamp":1652422395,
            "stateHash":"0x6104d07f7c285404dc58dd0b37894b20c4193a231499a20e4056d119fc2c1184",
            "commitment":commitment
        };
        await zklinkInETH.mockProveBlock(storedBlock);

        const fees = await lzBridgeInETH.estimateCommitmentBridgeFees(lzChainIdInBSC, false, "0x");
        const lzParams = {
            "dstChainId": lzChainIdInBSC,
            "refundAddress": alice.address,
            "zroPaymentAddress": ethers.constants.AddressZero,
            "adapterParams": "0x"
        }
        await expect(lzBridgeInETH.connect(alice).bridgeCommitment(storedBlock,
            lzParams, {value: fees.nativeFee}))
            .to.be.emit(zklinkInBSC, "ReceiveCommitment")
            .withArgs(lzBridgeInBSC.address, lzChainIdInETH, 1, commitment, 1);
    });

    it('test lz receive gas cost', async () => {
        const commitment = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        const verifiedChains = 15;
        const payload = ethers.utils.defaultAbiCoder.encode(["uint32","uint256"], [commitment,verifiedChains])
        const payloadWithType = ethers.utils.solidityPack(["uint8", "bytes"],[1, payload]);
        const nonce = 1;

        await expect(lzInETH.lzReceiveTest(lzChainIdInBSC,
            lzBridgeInBSC.address,
            lzBridgeInETH.address,
            nonce,
            payloadWithType))
            .to.be.emit(zklinkInETH, "ReceiveCommitment")
            .withArgs(lzBridgeInETH.address, lzChainIdInBSC, nonce, commitment, verifiedChains);
    });
});
