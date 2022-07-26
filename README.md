# Marketplace contracts
## Install
    yarn install
## Deploy
### V1 version
#### BSC Testnet
    npx hardhat run ./scripts/nft-marketplace-deploy.js --network bscTestnet
#### BSC Mainnet
    npx hardhat run ./scripts/nft-marketplace-deploy.js --network bscMainnet
### V2 version
#### BSC Testnet
    npx hardhat run ./scripts/nft-marketplace-deploy.js --network bscTestnet
#### BSC Mainnet
    npx hardhat run ./scripts/nft-marketplace-deploy.js --network bscMainnet
## Test
### All tests
    npm test
### Tests only for V2
    npm run testV2
## Coverage
### All tests
    npm run coverage
### Tests only for V2
    npm run coverageV2
## Prettier
    npm run prettier
## Docgen
    npx hardhat docgen