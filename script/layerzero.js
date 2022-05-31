// lz chain info
// https://layerzero.gitbook.io/docs/technical-reference/mainnet/supported-chain-ids
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const layerZero = {
    ETH: {
        chainId: 1,
        address: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'
    },
    BSC: {
        chainId: 2,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    AVAX: {
        chainId: 6,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    POLYGON: {
        chainId: 9,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    RINKEBY: {
        chainId: 10001,
        address: '0x79a63d6d8BBD5c6dfc774dA79bCcD948EAcb53FA'
    },
    BSCTEST: {
        chainId: 10002,
        address: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1'
    },
    AVAXTEST: {
        chainId: 10006,
        address: '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706'
    },
    POLYGONTEST: {
        chainId: 10009,
        address: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8'
    }
}

module.exports = {
    layerZero
};
