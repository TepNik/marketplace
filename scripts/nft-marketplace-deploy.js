const hre = require("hardhat");

const config = require("../config.js");
const utils = require("./utils");

async function main() {
    const networkName = hre.network.name;
    const availableNetworks = []; // = config.networks.keys();
    for (const network in config.networks) {
        availableNetworks.push(network);
    }
    if (!availableNetworks.includes(networkName)) {
        console.log("Wrong network");
        return;
    }
    console.log("Network:", networkName);

    const wNativeAddress = config.networks[networkName].wNative;
    const feeReceiverAddress = config.networks[networkName].feeReceiver;

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    await utils.deployAndVerify("NftMarketplace", [feeReceiverAddress, wNativeAddress]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
