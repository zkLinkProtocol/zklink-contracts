const { expect } = require('chai');
const { deploy } = require('./utils');

describe('DeployFactory unit tests', function () {
    it('deposit erc20 should success', async () => {
        const deployedInfo = await deploy();
        await deployedInfo.token2.contract.approve(deployedInfo.zkLink.address, 100);
        const to = "0x72847C8Bdc54b338E787352bceC33ba90cD7aFe0";
        await expect(deployedInfo.zkLink.depositERC20(deployedInfo.token2.contract.address, 30, to, 0)).to
            .emit(deployedInfo.zkLink, 'NewPriorityRequest');
    });
});
