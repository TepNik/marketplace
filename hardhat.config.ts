import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-chai-matchers";

// Automatic verification on etherscan, bscscan and others
// command: npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS
import "@nomiclabs/hardhat-etherscan";

// command: npx hardhat coverage
import "solidity-coverage";

// Writes bytecode sizes of smart contracts
import "hardhat-contract-sizer";

// Writes information of gas usage in tests
import "hardhat-gas-reporter";

// Exports smart contract ABIs on compilation
import "hardhat-abi-exporter";

// Writes SPDX License Identifier into sol files
// Type of license it takes from package.json
import "hardhat-spdx-license-identifier";

// command: npx hardhat check
import "@nomiclabs/hardhat-solhint";

// Prints events when running tests
// command: npx hardhat test --logs
import "hardhat-tracer";

import "@nomiclabs/hardhat-web3";

import "solidity-docgen";

let config = require("./config.js");

module.exports = {
    networks: {
        hardhat: {},
        ethereumMainnet: {
            url: "https://rinkeby.infura.io/v3/" + config.infuraIdProject,
            accounts: config.mainnetAccountsPK,
        },
        ropsten: {
            url: "https://ropsten.infura.io/v3/" + config.infuraIdProject,
            accounts: config.testnetAccountsPK,
        },
        kovan: {
            url: "https://kovan.infura.io/v3/" + config.infuraIdProject,
            accounts: config.testnetAccountsPK,
        },
        rinkeby: {
            url: "https://rinkeby.infura.io/v3/" + config.infuraIdProject,
            accounts: config.testnetAccountsPK,
        },
        goerli: {
            url: "https://goerli.infura.io/v3/" + config.infuraIdProject,
            accounts: config.testnetAccountsPK,
        },
        bscMainnet: {
            url: "https://bsc-dataseed3.binance.org",
            accounts: config.mainnetAccountsPK,
        },
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            accounts: config.testnetAccountsPK,
        },
        polygonMainnet: {
            url: "https://rpc-mainnet.maticvigil.com",
            accounts: config.mainnetAccountsPK,
        },
        polygonTestnet: {
            url: "https://matic-mumbai.chainstacklabs.com",
            accounts: config.testnetAccountsPK,
        },
    },
    etherscan: {
        apiKey: config.apiKey,
    },
    solidity: {
        compilers: [
            {
                version: "0.8.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
    },
    mocha: {
        timeout: 100000,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: false,
        disambiguatePaths: false,
    },
    gasReporter: {
        currency: "USD",
        coinmarketcap: config.coinmarketcapApi,
        token: "BNB",
        excludeContracts: ["test/"],
    },
    abiExporter: {
        path: "./data/abi",
        clear: true,
        flat: true,
        spacing: 4,
        runOnCompile: true,
        pretty: false,
    },
    spdxLicenseIdentifier: {
        overwrite: false,
        runOnCompile: true,
    },
    docgen: {
        pages: "items",
        exclude: ["test/"],
    },
} as HardhatUserConfig;
