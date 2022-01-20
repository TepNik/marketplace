const { expect } = require("chai");
//const { ethers } = require("ethers");
const { randomBytes } = require("crypto");

const BN = ethers.BigNumber;

const Decimals = BN.from(18);
const OneToken = BN.from(10).pow(Decimals);

describe("Token test", function () {
    let token1Inst;
    let token2Inst;

    let erc721Inst1;
    let erc721Inst2;

    let erc1155Inst1;
    let erc1155Inst2;

    let nftMarketplaceInst;
    //let nftMarketplaceInterface;

    let deployer;
    let feeReceiver;
    let user1;
    let user2;
    let user3;

    let timestampNow;

    let feePercentage;

    beforeEach(async () => {
        [deployer, feeReceiver, user1, user2, user3] = await ethers.getSigners();
        hre.tracer.nameTags[deployer.address] = "deployer";
        hre.tracer.nameTags[feeReceiver.address] = "feeReceiver";
        hre.tracer.nameTags[user1.address] = "user1";
        hre.tracer.nameTags[user2.address] = "user2";
        hre.tracer.nameTags[user3.address] = "user3";

        const TestERC20Factory = await ethers.getContractFactory("TestERC20");
        token1Inst = await TestERC20Factory.deploy();
        token2Inst = await TestERC20Factory.deploy();
        hre.tracer.nameTags[token1Inst.address] = "token1Inst";
        hre.tracer.nameTags[token2Inst.address] = "token2Inst";

        const TestERC721Factory = await ethers.getContractFactory("TestERC721");
        erc721Inst1 = await TestERC721Factory.deploy();
        erc721Inst2 = await TestERC721Factory.deploy();
        hre.tracer.nameTags[erc721Inst1.address] = "erc721Inst1";
        hre.tracer.nameTags[erc721Inst2.address] = "erc721Inst2";

        const TestERC1155Factory = await ethers.getContractFactory("TestERC1155");
        erc1155Inst1 = await TestERC1155Factory.deploy();
        erc1155Inst2 = await TestERC1155Factory.deploy();
        hre.tracer.nameTags[erc1155Inst1.address] = "erc1155Inst1";
        hre.tracer.nameTags[erc1155Inst1.address] = "erc1155Inst2";

        const NftMarketplaceFactory = await ethers.getContractFactory("NftMarketplace");
        nftMarketplaceInst = await NftMarketplaceFactory.deploy(feeReceiver.address);
        hre.tracer.nameTags[nftMarketplaceInst.address] = "nftMarketplaceInst";

        feePercentage = BN.from(await nftMarketplaceInst.feePercentage());

        timestampNow = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber()))
            .timestamp;
    });

    it("Deploy test", async () => {
        expect(await nftMarketplaceInst.feeReceiver()).to.be.equals(feeReceiver.address);
        expect(await nftMarketplaceInst.isPaused()).to.be.false;
    });

    describe("Swap function", () => {
        it("Swap ERC721 to ERC20", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc721 = 1;

            let sellerNft = user1;
            let buyerNft = user2;

            await token1Inst.connect(buyerNft).mint(amountOfErc20);
            await token1Inst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst1.connect(sellerNft).mint(idOfErc721);
            await erc721Inst1
                .connect(sellerNft)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [0, token1Inst.address, 0, amountOfErc20],
                [1, erc721Inst1.address, idOfErc721, 0],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerNft, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await token1Inst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await token1Inst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst1.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);
        });

        it("Swap ERC20 to ERC721", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc721 = 1;

            let sellerErc20 = user1;
            let buyerErc20 = user2;

            await token1Inst.connect(sellerErc20).mint(amountOfErc20);
            await token1Inst
                .connect(sellerErc20)
                .approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst1.connect(buyerErc20).mint(idOfErc721);
            await erc721Inst1
                .connect(buyerErc20)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [1, erc721Inst1.address, idOfErc721, 0],
                [0, token1Inst.address, 0, amountOfErc20],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerErc20, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerErc20)
                .makeSwap(signatureInfo, signature, sellerErc20.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await token1Inst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await token1Inst.balanceOf(buyerErc20.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst1.ownerOf(idOfErc721)).to.be.equals(sellerErc20.address);
        });
    });

    describe("Admin functions", () => {});

    async function signInfo(user, info) {
        const encodedSignatureInfo = ethers.utils.defaultAbiCoder.encode(
            [
                "(address,(uint8,address,uint256,uint256),(uint8,address,uint256,uint256),uint256,bytes32)",
            ],
            [info]
        );
        const signature = await user.signMessage(ethers.utils.arrayify(encodedSignatureInfo));

        return signature;
    }
});
