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

module.exports = {
    verifyWithErrorHandle,
    readDeployerKey
};
