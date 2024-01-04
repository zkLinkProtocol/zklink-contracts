// zkLink chain info
const zkLinkConfig = require("./ZkLinkConfig.json");

function getChainConfig(zkLinkConfig, chainId, mainnet) {
    for (let [net, chainConfig] of Object.entries(zkLinkConfig)) {
        if (chainConfig.zkLinkChainId === chainId && chainConfig.mainnet === mainnet) {
            return {
                net: net,
                chainConfig: chainConfig
            };
        }
    }
    return {
        net: undefined,
        chainConfig: undefined
    };
}

function getEthChainConfig(zkLinkConfig, mainnet) {
    for (let [net, chainConfig] of Object.entries(zkLinkConfig)) {
        if (chainConfig.mainnet === mainnet && chainConfig.l1Gateway !== undefined) {
            return {
                net: net,
                chainConfig: chainConfig
            };
        }
    }
    return {
        net: undefined,
        chainConfig: undefined
    };
}

module.exports = {
    zkLinkConfig,
    getChainConfig,
    getEthChainConfig
};
