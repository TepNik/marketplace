module.exports = {
    // global constants
    testnetAccountsPK: ["0000000000000000000000000000000000000000000000000000000000000000"],
    mainnetAccountsPK: ["0000000000000000000000000000000000000000000000000000000000000000"],
    infuraIdProject: "abcd1234...",
    apiKey: "abcd1234...",
    coinmarketcapApi: "abcd1234...",

    // deploy constants
    networks: {
        bscMainnet: {
            wNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            feeReceiver: "0x0000000000000000000000000000000000000000",
        },
        bscTestnet: {
            wNative: "0x0dE8FCAE8421fc79B29adE9ffF97854a424Cad09",
            feeReceiver: "0x0000000000000000000000000000000000000000",
        },
    },
};
