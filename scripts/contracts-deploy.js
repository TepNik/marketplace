const hre = require("hardhat");

const config = require("../config.js");
const utils = require("./utils");

async function main() {
    const networkName = hre.network.name;
    if (networkName != "bscTestnet" && networkName != "bscMainnet") {
        console.log("Wrong network");
        return;
    }

    let wNativeAddress;
    if (networkName == "bscTestnet") {
        wNativeAddress = config.wNativeBscTestnet;
    } else if (networkName == "bscMainnet") {
        wNativeAddress = config.wNativeBscMainnet;
    }

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    await utils.deployAndVerify("NftMarketplace", [deployer.address, wNativeAddress]);

    /* const networkName = hre.network.name;
    if (networkName == "bscTestnet") {
        //await utils.deployAndVerify("TestERC20", []);
        await utils.deployAndVerify("TestERC721", []);
        await utils.deployAndVerify("TestERC1155", []);
    } */
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
