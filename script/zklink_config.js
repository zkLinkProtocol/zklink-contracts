// zkLink chain info
const zkLinkConfig = {
    POLYGON: {
        mainnet: true,
        zkLinkChainId: 1,
        layerZero: {
            chainId: 109,
            address: '0x3c2269811836af69497E5F486A85D7316753cf62'
        }
    },
    AVAX: {
        mainnet: true,
        zkLinkChainId: 2,
        layerZero: {
            chainId: 106,
            address: '0x3c2269811836af69497E5F486A85D7316753cf62'
        }
    },
    BSC: {
        mainnet: true,
        zkLinkChainId: 3,
        layerZero: {
            chainId: 102,
            address: '0x3c2269811836af69497E5F486A85D7316753cf62'
        }
    },
    ETH: {
        mainnet: true,
        zkLinkChainId: 4,
        layerZero: {
            chainId: 101,
            address: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'
        },
        l1Gateway: [
            {
                net: "LINEA",
                contractName: "LineaL1Gateway",
                initializeParams: [
                    "0xd19d4B5d358258f05D7B411E21A1460D11B0876F",
                    "0x051F1D88f0aF5763fB888eC4378b4D8B29ea3319",
                    "0x504A330327A089d8364C4ab3811Ee26976d388ce",
                ],
            }
        ]
    },
    ZKSYNC: {
        mainnet: true,
        zkLinkChainId: 5,
        layerZero: {
            chainId: 165,
            address: '0x9b896c0e23220469C7AE69cb4BbAE391eAa4C8da'
        }
    },
    SCROLL: {
        mainnet: true,
        zkLinkChainId: 6,
        layerZero: {
            chainId: 214,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        }
    },
    LINEA: {
        mainnet: true,
        zkLinkChainId: 7,
        layerZero: {
            chainId: 183,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        },
        l2Gateway: {
            contractName: "LineaL2Gateway",
            initializeParams: [
                "0x508Ca82Df566dCD1B0DE8296e70a96332cD644ec",
                "0x353012dc4a9A6cF55c941bADC267f82004A8ceB9",
                "0xA2Ee6Fce4ACB62D95448729cDb781e3BEb62504A",
            ],
        }
    },
    ZKPOLYGON: {
        mainnet: true,
        zkLinkChainId: 8,
        layerZero: {
            chainId: 158,
            address: '0x9740FF91F1985D8d2B71494aE1A2f723bb3Ed9E4'
        }
    },
    ARBITRUM: {
        mainnet: true,
        zkLinkChainId: 9,
        layerZero: {
            chainId: 110,
            address: '0x3c2269811836af69497E5F486A85D7316753cf62'
        }
    },
    OPTIMISM: {
        mainnet: true,
        zkLinkChainId: 10,
        layerZero: {
            chainId: 111,
            address: '0x3c2269811836af69497E5F486A85D7316753cf62'
        }
    },
    BASE: {
        mainnet: true,
        zkLinkChainId: 11,
        layerZero: {
            chainId: 184,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        }
    },
    MANTLE: {
        mainnet: true,
        zkLinkChainId: 12,
        layerZero: {
            chainId: 181,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        }
    },
    MANTA: {
        mainnet: true,
        zkLinkChainId: 13,
        layerZero: {
            chainId: 217,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        }
    },
    TAIKO: {
        mainnet: true,
        zkLinkChainId: 14,
    },
    OPBNB: {
        mainnet: true,
        zkLinkChainId: 15,
        layerZero: {
            chainId: 202,
            address: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7'
        }
    },
    STARKNET: {
        mainnet: true,
        zkLinkChainId: 16,
    },
    X1: {
        mainnet: true,
        zkLinkChainId: 17,
    },
    LIGHTLINK: {
        mainnet: true,
        zkLinkChainId: 18,
    },
    POLYGONTEST: {
        mainnet: false,
        zkLinkChainId: 1,
        layerZero: {
            chainId: 10109,
            address: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8'
        }
    },
    AVAXTEST: {
        mainnet: false,
        zkLinkChainId: 2,
        layerZero: {
            chainId: 10106,
            address: '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706'
        }
    },
    BSCTEST: {
        mainnet: false,
        zkLinkChainId: 3,
        layerZero: {
            chainId: 10102,
            address: '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1'
        }
    },
    GOERLI: {
        mainnet: false,
        zkLinkChainId: 4,
        layerZero: {
            chainId: 10121,
            address: '0xbfD2135BFfbb0B5378b56643c2Df8a87552Bfa23'
        },
        l1Gateway: [
            {
                net: "LINEATEST",
                contractName: "LineaL1Gateway",
                initializeParams: [
                    "0x70BaD09280FD342D02fe64119779BC1f0791BAC2",
                    "0x2D8b29213cCE9DeF01A01718078950C429F9A806",
                    "0x32d123756d32d3ed6580935f8edf416e57b940f4",
                ],
            }
        ]
    },
    SEPOLIA: {
        mainnet: false,
        zkLinkChainId: 4,
        layerZero: {
            chainId: 10161,
            address: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'
        }
    },
    ZKSYNCTEST: {
        mainnet: false,
        zkLinkChainId: 5,
        layerZero: {
            chainId: 10165,
            address: '0x093D2CF57f764f09C3c2Ac58a42A2601B8C79281'
        }
    },
    SCROLLTEST: {
        mainnet: false,
        zkLinkChainId: 6,
        layerZero: {
            chainId: 10214,
            address: '0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3'
        }
    },
    LINEATEST: {
        mainnet: false,
        zkLinkChainId: 7,
        layerZero: {
            chainId: 10157,
            address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
        },
        l2Gateway: {
            contractName: "LineaL2Gateway",
            initializeParams: [
                "0xC499a572640B64eA1C8c194c43Bc3E19940719dC",
                "0x7D9009F96dc1fF94401af63703De43b7cCf98D5D",
                "0xdfa112375c9be9d124932b1d104b73f888655329",
            ],
        }
    },
    ZKPOLYGONTEST: {
        mainnet: false,
        zkLinkChainId: 8,
        layerZero: {
            chainId: 10158,
            address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
        }
    },
    ARBITRUMTEST: {
        mainnet: false,
        zkLinkChainId: 9,
        layerZero: {
            chainId: 10231,
            address: '0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3'
        }
    },
    OPTIMISMTEST: {
        mainnet: false,
        zkLinkChainId: 10,
        layerZero: {
            chainId: 10232,
            address: '0x55370E0fBB5f5b8dAeD978BA1c075a499eB107B8'
        }
    },
    BASETEST: {
        mainnet: false,
        zkLinkChainId: 11,
        layerZero: {
            chainId: 10160,
            address: '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab'
        }
    },
    MANTLETEST: {
        mainnet: false,
        zkLinkChainId: 12,
        layerZero: {
            chainId: 10181,
            address: '0x2cA20802fd1Fd9649bA8Aa7E50F0C82b479f35fe'
        }
    },
    MANTATEST: {
        mainnet: false,
        zkLinkChainId: 13,
        layerZero: {
            chainId: 10221,
            address: '0x55370E0fBB5f5b8dAeD978BA1c075a499eB107B8'
        }
    },
    TAIKOTEST: {
        mainnet: false,
        zkLinkChainId: 14,
    },
    OPBNBTEST: {
        mainnet: false,
        zkLinkChainId: 15,
        layerZero: {
            chainId: 10202,
            address: '0x83c73Da98cf733B03315aFa8758834b36a195b87'
        }
    },
    STARKNETTEST: {
        mainnet: false,
        zkLinkChainId: 16,
    },
    X1TEST: {
        mainnet: false,
        zkLinkChainId: 17,
    },
    LIGHTLINKTEST: {
        mainnet: false,
        zkLinkChainId: 18,
    }
}

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

module.exports = {
    zkLinkConfig,
    getChainConfig
};
