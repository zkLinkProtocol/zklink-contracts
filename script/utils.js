const fs = require("fs");
const verifyWithErrorHandle = async (verify, successCallBack) => {
    try {
        await verify();
        successCallBack();
    } catch (e) {
        if (e.message.includes('Already Verified')) {
            console.log('Already Verified');
            successCallBack();
        } else {
            throw e;
        }
    }
}

function readDeployerKey() {
    return fs.readFileSync('script/.KEY', 'utf8').trim();
}

function readDeployContract(net, contractName) {
    const deployLogPath = `log/deploy_${net}.log`;
    if (!fs.existsSync(deployLogPath)) {
        console.log('%s deploy log not exist', net);
        return;
    }
    const data = fs.readFileSync(deployLogPath, 'utf8');
    const deployLog = JSON.parse(data);
    return deployLog[contractName];
}

module.exports = {
    verifyWithErrorHandle,
    readDeployerKey,
    readDeployContract
};
