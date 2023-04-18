const fs = require("fs");
const verifyWithErrorHandle = async (verify, successCallBack) => {
    try {
        await verify();
        successCallBack();
    } catch (e) {
        if (e.message.includes('Already Verified')
            || e.message.includes('Contract source code already verified')
            || e.message.includes('Smart-contract already verified')
        ) {
            console.log('Already Verified');
            successCallBack();
        } else {
            throw e;
        }
    }
}

function createOrGetDeployLog(name) {
    const deployLogPath = `log/${name}_${process.env.NET}.log`;
    console.log('deploy log path', deployLogPath);
    if (!fs.existsSync('log')) {
        fs.mkdirSync('log', true);
    }

    let deployLog = {};
    if (fs.existsSync(deployLogPath)) {
        const data = fs.readFileSync(deployLogPath, 'utf8');
        deployLog = JSON.parse(data);
    }
    return {deployLogPath, deployLog};
}

function getDeployLog(name) {
    const deployLogPath = `log/${name}_${process.env.NET}.log`;
    console.log('deploy log path', deployLogPath);
    if (!fs.existsSync(deployLogPath)) {
        throw 'deploy log not exist';
    }
    const data = fs.readFileSync(deployLogPath, 'utf8');
    let deployLog = JSON.parse(data);
    return {deployLogPath, deployLog};
}

function readDeployContract(logName, contractName, env = process.env.NET) {
    return readDeployLogField(logName, contractName, env);
}

function readDeployLogField(logName, fieldName, env = process.env.NET) {
    const deployLogPath = `log/${logName}_${env}.log`;
    if (!fs.existsSync(deployLogPath)) {
        throw 'deploy log not exist';
    }
    const data = fs.readFileSync(deployLogPath, 'utf8');
    const deployLog = JSON.parse(data);
    const fieldValue = deployLog[fieldName];
    if (fieldValue === undefined) {
        throw fieldName + ' not exit';
    }
    return fieldValue;
}

module.exports = {
    verifyWithErrorHandle,
    createOrGetDeployLog,
    getDeployLog,
    readDeployContract,
    readDeployLogField
};
