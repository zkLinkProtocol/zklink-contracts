const { expect } = require('chai');
const { deploy } = require('./utils');
const { extendAddress } = require('../script/op_utils');

describe('DeployFactory unit tests', function () {
    it('deposit erc20 should success', async () => {
        const deployedInfo = await deploy();
        const zkLink = deployedInfo.zkLink;
        const token2 = deployedInfo.token2.contract;
        const defaultSender = deployedInfo.defaultSender;
        await token2.connect(defaultSender).mint(100);
        await token2.connect(defaultSender).approve(deployedInfo.zkLink.target, 100);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        await expect(zkLink.connect(defaultSender).depositERC20(token2.target, 30, extendAddress(to), 0, false)).to
            .emit(deployedInfo.zkLink, 'NewPriorityRequest');
    });
});
