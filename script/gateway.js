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
    //   [messageService,tokenBridge,usdcBridge]
    initializeParams: [
      "0xC499a572640B64eA1C8c194c43Bc3E19940719dC",
      "0x7D9009F96dc1fF94401af63703De43b7cCf98D5D",
      "0xdfa112375c9be9d124932b1d104b73f888655329",
    ],
  },
  ETH: {
    LINEA: {
      contractName: "LineaL1Gateway",
      //   [messageService,tokenBridge,usdcBridge]
      initializeParams: [
        "0xd19d4B5d358258f05D7B411E21A1460D11B0876F",
        "0x051F1D88f0aF5763fB888eC4378b4D8B29ea3319",
        "0x504A330327A089d8364C4ab3811Ee26976d388ce",
      ],
    },
  },
  LINEA: {
    contractName: "LineaL2Gateway",
    //   [messageService,tokenBridge,usdcBridge]
    initializeParams: [
      "0x508Ca82Df566dCD1B0DE8296e70a96332cD644ec",
      "0x353012dc4a9A6cF55c941bADC267f82004A8ceB9",
      "0xA2Ee6Fce4ACB62D95448729cDb781e3BEb62504A",
    ],
  }
};
