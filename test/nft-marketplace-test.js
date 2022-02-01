const { expect } = require("chai");
//const { ethers } = require("ethers");
const { randomBytes } = require("crypto");

const BN = ethers.BigNumber;

const Decimals = BN.from(18);
const OneToken = BN.from(10).pow(Decimals);

describe("NFT Marketplace tests", function () {
    let tokenInst;
    let erc721Inst;
    let erc1155Inst;

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
        tokenInst = await TestERC20Factory.deploy();
        hre.tracer.nameTags[tokenInst.address] = "tokenInst";

        const TestERC721Factory = await ethers.getContractFactory("TestERC721");
        erc721Inst = await TestERC721Factory.deploy();
        hre.tracer.nameTags[erc721Inst.address] = "erc721Inst";

        const TestERC1155Factory = await ethers.getContractFactory("TestERC1155");
        erc1155Inst = await TestERC1155Factory.deploy();
        hre.tracer.nameTags[erc1155Inst.address] = "erc1155Inst";

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

            await tokenInst.connect(buyerNft).mint(amountOfErc20);
            await tokenInst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst.connect(sellerNft).mint(idOfErc721);
            await erc721Inst.connect(sellerNft).setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [0, tokenInst.address, 0, amountOfErc20],
                [1, erc721Inst.address, idOfErc721, 0],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerNft, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);
        });

        it("Swap ERC20 to ERC721", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc721 = 1;

            let sellerErc20 = user1;
            let buyerErc20 = user2;

            await tokenInst.connect(sellerErc20).mint(amountOfErc20);
            await tokenInst.connect(sellerErc20).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst.connect(buyerErc20).mint(idOfErc721);
            await erc721Inst
                .connect(buyerErc20)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [1, erc721Inst.address, idOfErc721, 0],
                [0, tokenInst.address, 0, amountOfErc20],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerErc20, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerErc20)
                .makeSwap(signatureInfo, signature, sellerErc20.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(sellerErc20.address);
        });

        it("Swap ERC1155 to ERC20", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc1155 = 1;
            const amountOfErc1155 = 1;

            let sellerNft = user1;
            let buyerNft = user2;

            await tokenInst.connect(buyerNft).mint(amountOfErc20);
            await tokenInst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc1155Inst.connect(sellerNft).mint(idOfErc1155, amountOfErc1155);
            await erc1155Inst
                .connect(sellerNft)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [0, tokenInst.address, 0, amountOfErc20],
                [2, erc1155Inst.address, idOfErc1155, amountOfErc1155],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerNft, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc1155Inst.balanceOf(buyerNft.address, idOfErc1155)).to.be.equals(
                amountOfErc1155
            );
        });

        it("Swap ERC20 to ERC1155", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc1155 = 1;
            const amountOfErc1155 = 1;

            let sellerErc20 = user1;
            let buyerErc20 = user2;

            await tokenInst.connect(sellerErc20).mint(amountOfErc20);
            await tokenInst.connect(sellerErc20).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc1155Inst.connect(buyerErc20).mint(idOfErc1155, amountOfErc1155);
            await erc1155Inst
                .connect(buyerErc20)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;
            const orderId = ethers.utils.randomBytes(32);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [2, erc1155Inst.address, idOfErc1155, amountOfErc1155],
                [0, tokenInst.address, 0, amountOfErc20],
                deadline,
                orderId,
            ];
            const signature = await signInfo(sellerErc20, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerErc20)
                .makeSwap(signatureInfo, signature, sellerErc20.address);

            let feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc1155Inst.balanceOf(sellerErc20.address, idOfErc1155)).to.be.equals(
                amountOfErc1155
            );
        });
    });

    describe("Admin functions", () => {
        it("setFeePercentage()", async () => {
            expect(await nftMarketplaceInst.feePercentage()).to.be.equals(250);

            let newValue = 500;
            expect(await nftMarketplaceInst.connect(deployer).setFeePercentage(newValue))
                .to.emit(nftMarketplaceInst, "FeePercentageChange")
                .withArgs(deployer.address, 250, 500);

            await expect(
                nftMarketplaceInst.connect(deployer).setFeePercentage(newValue)
            ).to.be.revertedWith("NftMarketplace: No change");

            await expect(nftMarketplaceInst.connect(user1).setFeePercentage(newValue)).to.be
                .reverted;

            newValue = 1001;
            await expect(
                nftMarketplaceInst.connect(deployer).setFeePercentage(newValue)
            ).to.be.revertedWith("NftMarketplace: Too big percentage");
        });

        it("setFeeReceiver()", async () => {
            expect(await nftMarketplaceInst.feeReceiver()).to.be.equals(feeReceiver.address);

            let newValue = user1.address;
            expect(await nftMarketplaceInst.connect(deployer).setFeeReceiver(newValue))
                .to.emit(nftMarketplaceInst, "FeeReceiverChange")
                .withArgs(deployer.address, feeReceiver.address, user1.address);

            await expect(
                nftMarketplaceInst.connect(deployer).setFeeReceiver(newValue)
            ).to.be.revertedWith("NftMarketplace: No change");

            await expect(nftMarketplaceInst.connect(user1).setFeeReceiver(newValue)).to.be.reverted;

            newValue = ethers.constants.AddressZero;
            await expect(
                nftMarketplaceInst.connect(deployer).setFeeReceiver(newValue)
            ).to.be.revertedWith("NftMarketplace: Zero address");
        });

        it("togglePause()", async () => {
            expect(await nftMarketplaceInst.isPaused()).to.be.false;

            expect(await nftMarketplaceInst.connect(deployer).togglePause())
                .to.emit(nftMarketplaceInst, "SwapsPaused")
                .withArgs(deployer.address);

            const signatureInfo = [
                nftMarketplaceInst.address,
                [0, tokenInst.address, 0, 1],
                [1, erc721Inst.address, 0, 1],
                timestampNow,
                ethers.constants.HashZero,
            ];
            const signature = await signInfo(user1, signatureInfo);
            await expect(
                nftMarketplaceInst.connect(user2).makeSwap(signatureInfo, signature, user1.address)
            ).to.be.revertedWith("NftMarketplace: Swaps paused");

            expect(await nftMarketplaceInst.connect(deployer).togglePause())
                .to.emit(nftMarketplaceInst, "SwapsUnpaused")
                .withArgs(deployer.address);

            await expect(nftMarketplaceInst.connect(user1).togglePause()).to.be.reverted;
        });
    });

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
