const hre = require("hardhat");

const config = require("../config.js");
const utils = require("./utils");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    await utils.deployAndVerify("NftMarketplace", [deployer.address]);

    /* const networkName = hre.network.name;
    if (networkName == "bscTestnet") {
        await utils.deployAndVerify("TestERC20", []);
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
