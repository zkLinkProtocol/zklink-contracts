module.exports = {
  GOERLI: {
    LINEATEST: {
      contractName: "LineaL1Gateway",
      //   [messageService,tokenBridge,usdcBridge]
      initializeParams: [
        "0x70BaD09280FD342D02fe64119779BC1f0791BAC2",
        "0x2D8b29213cCE9DeF01A01718078950C429F9A806",
        "0x32d123756d32d3ed6580935f8edf416e57b940f4",
      ],
    },
  },
  LINEATEST: {
    contractName: "LineaL2Gateway",
    //   [messageService,zklink，tokenBridge,usdcBridge]
    initializeParams: [
      "0xC499a572640B64eA1C8c194c43Bc3E19940719dC",
      "0x86e7eef46352e9de0e51d2fc999d299240ab5240",
      "0x7D9009F96dc1fF94401af63703De43b7cCf98D5D",
      "0xdfa112375c9be9d124932b1d104b73f888655329",
    ],
  },
};
