// lz chain info
// https://layerzero.gitbook.io/docs/technical-reference/mainnet/supported-chain-ids
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const layerZero = {
    ETH: {
        mainnet: true,
        zkLinkChainId: 4,
        chainId: 101,
        address: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'
    },
    BSC: {
        mainnet: true,
        zkLinkChainId: 3,
        chainId: 102,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    AVAX: {
        mainnet: true,
        zkLinkChainId: 2,
        chainId: 106,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    POLYGON: {
        mainnet: true,
        zkLinkChainId: 1,
        chainId: 109,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    ARBITRUM: {
        mainnet: true,
        zkLinkChainId: 9,
        chainId: 110,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    OPTIMISM: {
        mainnet: true,
        zkLinkChainId: 10,
        chainId: 111,
        address: '0x3c2269811836af69497E5F486A85D7316753cf62'
    },
    ZKPOLYGON: {
        mainnet: true,
        zkLinkChainId: 8,
        chainId: 158,
        address: '0x9740FF91F1985D8d2B71494aE1A2f723bb3Ed9E4'
    },
    ZKSYNC: {
        mainnet: true,
        zkLinkChainId: 5,
        chainId: 165,
        address: '0x9b896c0e23220469C7AE69cb4BbAE391eAa4C8da'
    },
    MANTLE: {
        mainnet: true,
        zkLinkChainId: 12,
        chainId: 181,
        address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
    },
    LINEA: {
        mainnet: true,
        zkLinkChainId: 7,
        chainId: 183,
        address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
    },
    BASE: {
        mainnet: true,
        zkLinkChainId: 11,
        chainId: 184,
        address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
    },
    OPBNB: {
        mainnet: true,
        zkLinkChainId: 15,
        chainId: 202,
        address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
    },
    SCROLL: {
        mainnet: true,
        zkLinkChainId: 6,
        chainId: 214,
        address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
    },
    GOERLI: {
        mainnet: false,
        zkLinkChainId: 4,
        chainId: 10121,
        address: '0xbfD2135BFfbb0B5378b56643c2Df8a87552Bfa23'
    },
    BSCTEST: {
        mainnet: false,
        zkLinkChainId: 3,
        chainId: 10102,
        address: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1'
    },
    AVAXTEST: {
        mainnet: false,
        zkLinkChainId: 2,
        chainId: 10106,
        address: '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706'
    },
    POLYGONTEST: {
        mainnet: false,
        zkLinkChainId: 1,
        chainId: 10109,
        address: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8'
    },
    OPTIMISMTEST: {
        mainnet: false,
        zkLinkChainId: 10,
        chainId: 10132,
        address: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'
    },
    ARBITRUMTEST: {
        mainnet: false,
        zkLinkChainId: 9,
        chainId: 10143,
        address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
    },
    ZKSYNCTEST: {
        mainnet: false,
        zkLinkChainId: 5,
        chainId: 10165,
        address: '0x093D2CF57f764f09C3c2Ac58a42A2601B8C79281'
    },
    LINEATEST: {
        mainnet: false,
        zkLinkChainId: 7,
        chainId: 10157,
        address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
    },
    ZKPOLYGONTEST: {
        mainnet: false,
        zkLinkChainId: 8,
        chainId: 10158,
        address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
    },
    BASETEST: {
        mainnet: false,
        zkLinkChainId: 11,
        chainId: 10160,
        address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
    },
    SCROLLTEST: {
        mainnet: false,
        zkLinkChainId: 6,
        chainId: 10170,
        address: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'
    },
    MANTLETEST: {
        mainnet: false,
        zkLinkChainId: 12,
        chainId: 10181,
        address: '0x2cA20802fd1Fd9649bA8Aa7E50F0C82b479f35fe'
    },
    OPBNBTEST: {
        mainnet: false,
        zkLinkChainId: 15,
        chainId: 10202,
        address: '0x83c73Da98cf733B03315aFa8758834b36a195b87'
    }
}

module.exports = {
    layerZero
};
