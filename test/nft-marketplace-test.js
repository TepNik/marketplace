const { snapshot } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
//const { ethers } = require("ethers");
const { randomBytes } = require("crypto");

const BN = ethers.BigNumber;

const Decimals = BN.from(18);
const OneToken = BN.from(10).pow(Decimals);
const OneEth = ethers.constants.WeiPerEther;

describe("NFT Marketplace tests", function () {
    let tokenInst;
    let erc721Inst;
    let erc721OwnableInst;
    let erc1155Inst;
    let erc1155OwnableInst;

    let wNativeInst;

    let nftMarketplaceInst;
    //const nftMarketplaceInterface;

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

        const TestERC721OwnableFactory = await ethers.getContractFactory("TestERC721Ownable");
        erc721OwnableInst = await TestERC721OwnableFactory.deploy();
        hre.tracer.nameTags[erc721OwnableInst.address] = "erc721OwnableInst";

        const TestERC1155Factory = await ethers.getContractFactory("TestERC1155");
        erc1155Inst = await TestERC1155Factory.deploy();
        hre.tracer.nameTags[erc1155Inst.address] = "erc1155Inst";

        const TestERC1155OwnableFactory = await ethers.getContractFactory("TestERC1155Ownable");
        erc1155OwnableInst = await TestERC1155OwnableFactory.deploy();
        hre.tracer.nameTags[erc1155OwnableInst.address] = "erc1155OwnableInst";

        wNativeInst = await TestERC20Factory.deploy();
        hre.tracer.nameTags[wNativeInst.address] = "wNativeInst";

        const NftMarketplaceFactory = await ethers.getContractFactory("NftMarketplace");
        nftMarketplaceInst = await NftMarketplaceFactory.deploy(
            feeReceiver.address,
            wNativeInst.address
        );
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

            const sellerNft = user1;
            const buyerNft = user2;

            await tokenInst.connect(buyerNft).mint(amountOfErc20);
            await tokenInst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst.connect(sellerNft).mint(idOfErc721);
            await erc721Inst.connect(sellerNft).setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;

            const signatureInfo = [
                nftMarketplaceInst.address,
                sellerNft.address,
                [0, tokenInst.address, 0, amountOfErc20],
                [1, erc721Inst.address, idOfErc721, 0],
                deadline,
            ];
            const [signature, orderId] = await signInfo(sellerNft, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
        });

        it("Swap ERC721 to native", async () => {
            const amountOfNative = OneEth;
            const idOfErc721 = 1;

            const sellerNft = user1;
            const buyerNft = user2;

            await wNativeInst.connect(buyerNft).mint(amountOfNative);
            await wNativeInst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfNative);

            await erc721Inst.connect(sellerNft).mint(idOfErc721);
            await erc721Inst.connect(sellerNft).setApprovalForAll(nftMarketplaceInst.address, true);

            const ethBalanceSellerBefore = await ethers.provider.getBalance(sellerNft.address);
            const ethBalanceFeeReceiverBefore = await ethers.provider.getBalance(
                feeReceiver.address
            );

            const deadline = timestampNow + 1000000;

            const signatureInfo = [
                nftMarketplaceInst.address,
                sellerNft.address,
                [0, wNativeInst.address, 0, amountOfNative],
                [1, erc721Inst.address, idOfErc721, 0],
                deadline,
            ];
            const [signature, orderId] = await signInfo(sellerNft, signatureInfo);

            const snapshotBefore = await snapshot();

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            let feeAmount = feePercentage.mul(amountOfNative).div(10000);
            expect(await wNativeInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await wNativeInst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfNative.sub(feeAmount)
            );
            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;

            await snapshotBefore.restore();

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address, {
                    value: amountOfNative,
                });

            const ethBalanceSellerAfter = await ethers.provider.getBalance(sellerNft.address);
            const ethBalanceFeeReceiverAfter = await ethers.provider.getBalance(
                feeReceiver.address
            );

            feeAmount = feePercentage.mul(amountOfNative).div(10000);
            expect(await wNativeInst.balanceOf(feeReceiver.address)).to.be.equals(0);
            expect(await wNativeInst.balanceOf(sellerNft.address)).to.be.equals(0);
            expect(await wNativeInst.balanceOf(buyerNft.address)).to.be.equals(amountOfNative);

            expect(ethBalanceSellerAfter.sub(ethBalanceSellerBefore)).to.be.equals(
                amountOfNative.sub(feeAmount)
            );
            expect(ethBalanceFeeReceiverAfter.sub(ethBalanceFeeReceiverBefore)).to.be.equals(
                feeAmount
            );

            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
        });

        it("Swap ERC20 to ERC721", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc721 = 1;

            const sellerErc20 = user1;
            const buyerErc20 = user2;

            await tokenInst.connect(sellerErc20).mint(amountOfErc20);
            await tokenInst.connect(sellerErc20).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc721Inst.connect(buyerErc20).mint(idOfErc721);
            await erc721Inst
                .connect(buyerErc20)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;

            const signatureInfo = [
                nftMarketplaceInst.address,
                sellerErc20.address,
                [1, erc721Inst.address, idOfErc721, 0],
                [0, tokenInst.address, 0, amountOfErc20],
                deadline,
            ];
            const [signature, orderId] = await signInfo(sellerErc20, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerErc20)
                .makeSwap(signatureInfo, signature, sellerErc20.address);

            const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc721Inst.ownerOf(idOfErc721)).to.be.equals(sellerErc20.address);

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
        });

        it("Swap ERC1155 to ERC20", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc1155 = 1;
            const amountOfErc1155 = 1;

            const sellerNft = user1;
            const buyerNft = user2;

            await tokenInst.connect(buyerNft).mint(amountOfErc20);
            await tokenInst.connect(buyerNft).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc1155Inst.connect(sellerNft).mint(idOfErc1155, amountOfErc1155);
            await erc1155Inst
                .connect(sellerNft)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;

            const signatureInfo = [
                nftMarketplaceInst.address,
                sellerNft.address,
                [0, tokenInst.address, 0, amountOfErc20],
                [2, erc1155Inst.address, idOfErc1155, amountOfErc1155],
                deadline,
            ];
            const [signature, orderId] = await signInfo(sellerNft, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerNft)
                .makeSwap(signatureInfo, signature, sellerNft.address);

            const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc1155Inst.balanceOf(buyerNft.address, idOfErc1155)).to.be.equals(
                amountOfErc1155
            );

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
        });

        it("Swap ERC20 to ERC1155", async () => {
            const amountOfErc20 = OneToken.mul(10);
            const idOfErc1155 = 1;
            const amountOfErc1155 = 1;

            const sellerErc20 = user1;
            const buyerErc20 = user2;

            await tokenInst.connect(sellerErc20).mint(amountOfErc20);
            await tokenInst.connect(sellerErc20).approve(nftMarketplaceInst.address, amountOfErc20);

            await erc1155Inst.connect(buyerErc20).mint(idOfErc1155, amountOfErc1155);
            await erc1155Inst
                .connect(buyerErc20)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            const deadline = timestampNow + 1000000;

            const signatureInfo = [
                nftMarketplaceInst.address,
                sellerErc20.address,
                [2, erc1155Inst.address, idOfErc1155, amountOfErc1155],
                [0, tokenInst.address, 0, amountOfErc20],
                deadline,
            ];
            const [signature, orderId] = await signInfo(sellerErc20, signatureInfo);

            await nftMarketplaceInst
                .connect(buyerErc20)
                .makeSwap(signatureInfo, signature, sellerErc20.address);

            const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
            expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
            expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                amountOfErc20.sub(feeAmount)
            );
            expect(await erc1155Inst.balanceOf(sellerErc20.address, idOfErc1155)).to.be.equals(
                amountOfErc1155
            );

            expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
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

            await expect(nftMarketplaceInst.connect(user1).togglePause()).to.be.reverted;
            expect(await nftMarketplaceInst.connect(deployer).togglePause())
                .to.emit(nftMarketplaceInst, "SwapsPaused")
                .withArgs(deployer.address);

            const signatureInfo = [
                nftMarketplaceInst.address,
                user1.address,
                [0, tokenInst.address, 0, 1],
                [1, erc721Inst.address, 0, 1],
                timestampNow,
            ];
            const [signature, orderId] = await signInfo(user1, signatureInfo);
            await expect(
                nftMarketplaceInst.connect(user2).makeSwap(signatureInfo, signature, user1.address)
            ).to.be.revertedWith("NftMarketplace: Swaps paused");

            expect(await nftMarketplaceInst.connect(deployer).togglePause())
                .to.emit(nftMarketplaceInst, "SwapsUnpaused")
                .withArgs(deployer.address);

            await expect(nftMarketplaceInst.connect(user1).togglePause()).to.be.reverted;
        });

        it("setRoyalty() & disableAdminRoyalty()", async () => {
            await expect(
                nftMarketplaceInst.connect(user1).setRoyalty(erc721Inst.address, user1.address, 100)
            ).to.be.reverted;
            await expect(
                nftMarketplaceInst.connect(deployer).setRoyalty(user1.address, user1.address, 100)
            ).to.be.revertedWith("RoyaltiesInfo: Not a contract");
            await expect(
                nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(nftMarketplaceInst.address, user1.address, 100)
            ).to.be.revertedWith("RoyaltiesInfo: Wrong interface");
            await expect(
                nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc721Inst.address, user1.address, 1001)
            ).to.be.revertedWith("RoyaltiesInfo: Percentage");
            await expect(
                nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc721Inst.address, ethers.constants.AddressZero, 100)
            ).to.be.revertedWith("RoyaltiesInfo: royaltyReceiver");

            expect(
                await nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc721Inst.address, user1.address, 100)
            )
                .to.emit(nftMarketplaceInst, "AddedAdminRoyalty")
                .withArgs(deployer.address, erc721Inst.address, user1.address, 100);
            await nftMarketplaceInst
                .connect(deployer)
                .setRoyalty(erc1155Inst.address, user1.address, 100);

            const royaltyInfo = await nftMarketplaceInst.royaltiesInfo(erc721Inst.address);
            expect(royaltyInfo.isEnabled).to.be.true;
            expect(royaltyInfo.royaltyReceiver).to.be.equals(user1.address);
            expect(royaltyInfo.royaltyPercentage).to.be.equals(100);

            await expect(nftMarketplaceInst.connect(user1).disableAdminRoyalty(erc721Inst.address))
                .to.be.reverted;
            expect(
                await nftMarketplaceInst.connect(deployer).disableAdminRoyalty(erc721Inst.address)
            )
                .to.emit(nftMarketplaceInst, "DisabledAdminRoyalty")
                .withArgs(deployer.address, erc721Inst.address);

            const royaltyInfoAfter = await nftMarketplaceInst.royaltiesInfo(erc721Inst.address);
            expect(royaltyInfoAfter.isEnabled).to.be.false;
            expect(royaltyInfoAfter.royaltyReceiver).to.be.equals(ethers.constants.AddressZero);
            expect(royaltyInfoAfter.royaltyPercentage).to.be.equals(0);
        });
    });

    describe("Royalties", () => {
        it("Setting/disabling royalties", async () => {
            let royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721Inst.address);
            expect(royaltyInfo[0]).to.be.equals(ethers.constants.AddressZero);
            expect(royaltyInfo[1]).to.be.equals(0);

            royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721OwnableInst.address);
            expect(royaltyInfo[0]).to.be.equals(deployer.address);
            expect(royaltyInfo[1]).to.be.equals(250);

            await nftMarketplaceInst.setRoyalty(erc721Inst.address, user1.address, 100);
            royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721Inst.address);
            expect(royaltyInfo[0]).to.be.equals(user1.address);
            expect(royaltyInfo[1]).to.be.equals(100);
            await nftMarketplaceInst.disableAdminRoyalty(erc721Inst.address);
            royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721Inst.address);
            expect(royaltyInfo[0]).to.be.equals(ethers.constants.AddressZero);
            expect(royaltyInfo[1]).to.be.equals(0);

            await nftMarketplaceInst.setRoyalty(erc721OwnableInst.address, user2.address, 200);
            royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721OwnableInst.address);
            expect(royaltyInfo[0]).to.be.equals(user2.address);
            expect(royaltyInfo[1]).to.be.equals(200);
            await nftMarketplaceInst.disableAdminRoyalty(erc721OwnableInst.address);
            royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(erc721OwnableInst.address);
            expect(royaltyInfo[0]).to.be.equals(deployer.address);
            expect(royaltyInfo[1]).to.be.equals(250);
        });

        describe("Swaps with royalties", () => {
            it("Swap ERC721 to ERC20", async () => {
                const amountOfErc20 = OneToken.mul(10);
                const idOfErc721 = 1;

                const sellerNft = user1;
                const buyerNft = user2;

                await tokenInst.connect(buyerNft).mint(amountOfErc20);
                await tokenInst
                    .connect(buyerNft)
                    .approve(nftMarketplaceInst.address, amountOfErc20);

                await erc721OwnableInst.connect(sellerNft).mint(idOfErc721);
                await erc721OwnableInst
                    .connect(sellerNft)
                    .setApprovalForAll(nftMarketplaceInst.address, true);

                const deadline = timestampNow + 1000000;

                const signatureInfo = [
                    nftMarketplaceInst.address,
                    sellerNft.address,
                    [0, tokenInst.address, 0, amountOfErc20],
                    [1, erc721OwnableInst.address, idOfErc721, 0],
                    deadline,
                ];
                const [signature, orderId] = await signInfo(sellerNft, signatureInfo);

                await nftMarketplaceInst
                    .connect(buyerNft)
                    .makeSwap(signatureInfo, signature, sellerNft.address);

                const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
                const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address
                );
                const royaltyAmount = amountOfErc20.mul(royaltyInfo[1]).div(10000);
                expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
                expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                    amountOfErc20.sub(feeAmount).sub(royaltyAmount)
                );
                expect(await tokenInst.balanceOf(royaltyInfo[0])).to.be.equals(royaltyAmount);
                expect(await erc721OwnableInst.ownerOf(idOfErc721)).to.be.equals(buyerNft.address);

                expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
            });

            it("Swap ERC20 to ERC721", async () => {
                const amountOfErc20 = OneToken.mul(10);
                const idOfErc721 = 1;

                const sellerErc20 = user1;
                const buyerErc20 = user2;

                await tokenInst.connect(sellerErc20).mint(amountOfErc20);
                await tokenInst
                    .connect(sellerErc20)
                    .approve(nftMarketplaceInst.address, amountOfErc20);

                await erc721OwnableInst.connect(buyerErc20).mint(idOfErc721);
                await erc721OwnableInst
                    .connect(buyerErc20)
                    .setApprovalForAll(nftMarketplaceInst.address, true);

                const deadline = timestampNow + 1000000;

                const signatureInfo = [
                    nftMarketplaceInst.address,
                    sellerErc20.address,
                    [1, erc721OwnableInst.address, idOfErc721, 0],
                    [0, tokenInst.address, 0, amountOfErc20],
                    deadline,
                ];
                const [signature, orderId] = await signInfo(sellerErc20, signatureInfo);

                await nftMarketplaceInst
                    .connect(buyerErc20)
                    .makeSwap(signatureInfo, signature, sellerErc20.address);

                const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
                const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address
                );
                const royaltyAmount = amountOfErc20.mul(royaltyInfo[1]).div(10000);
                expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
                expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                    amountOfErc20.sub(feeAmount).sub(royaltyAmount)
                );
                expect(await tokenInst.balanceOf(royaltyInfo[0])).to.be.equals(royaltyAmount);
                expect(await erc721OwnableInst.ownerOf(idOfErc721)).to.be.equals(
                    sellerErc20.address
                );

                expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
            });

            it("Swap ERC1155 to ERC20", async () => {
                const amountOfErc20 = OneToken.mul(10);
                const idOfErc1155 = 1;
                const amountOfErc1155 = 1;

                const sellerNft = user1;
                const buyerNft = user2;

                await tokenInst.connect(buyerNft).mint(amountOfErc20);
                await tokenInst
                    .connect(buyerNft)
                    .approve(nftMarketplaceInst.address, amountOfErc20);

                await erc1155OwnableInst.connect(sellerNft).mint(idOfErc1155, amountOfErc1155);
                await erc1155OwnableInst
                    .connect(sellerNft)
                    .setApprovalForAll(nftMarketplaceInst.address, true);

                const deadline = timestampNow + 1000000;

                const signatureInfo = [
                    nftMarketplaceInst.address,
                    sellerNft.address,
                    [0, tokenInst.address, 0, amountOfErc20],
                    [2, erc1155OwnableInst.address, idOfErc1155, amountOfErc1155],
                    deadline,
                ];
                const [signature, orderId] = await signInfo(sellerNft, signatureInfo);

                await nftMarketplaceInst
                    .connect(buyerNft)
                    .makeSwap(signatureInfo, signature, sellerNft.address);

                const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
                const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address
                );
                const royaltyAmount = amountOfErc20.mul(royaltyInfo[1]).div(10000);
                expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
                expect(await tokenInst.balanceOf(sellerNft.address)).to.be.equals(
                    amountOfErc20.sub(feeAmount).sub(royaltyAmount)
                );
                expect(await tokenInst.balanceOf(royaltyInfo[0])).to.be.equals(royaltyAmount);
                expect(
                    await erc1155OwnableInst.balanceOf(buyerNft.address, idOfErc1155)
                ).to.be.equals(amountOfErc1155);

                expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
            });

            it("Swap ERC20 to ERC1155", async () => {
                const amountOfErc20 = OneToken.mul(10);
                const idOfErc1155 = 1;
                const amountOfErc1155 = 1;

                const sellerErc20 = user1;
                const buyerErc20 = user2;

                await tokenInst.connect(sellerErc20).mint(amountOfErc20);
                await tokenInst
                    .connect(sellerErc20)
                    .approve(nftMarketplaceInst.address, amountOfErc20);

                await erc1155OwnableInst.connect(buyerErc20).mint(idOfErc1155, amountOfErc1155);
                await erc1155OwnableInst
                    .connect(buyerErc20)
                    .setApprovalForAll(nftMarketplaceInst.address, true);

                const deadline = timestampNow + 1000000;

                const signatureInfo = [
                    nftMarketplaceInst.address,
                    sellerErc20.address,
                    [2, erc1155OwnableInst.address, idOfErc1155, amountOfErc1155],
                    [0, tokenInst.address, 0, amountOfErc20],
                    deadline,
                ];
                const [signature, orderId] = await signInfo(sellerErc20, signatureInfo);

                await nftMarketplaceInst
                    .connect(buyerErc20)
                    .makeSwap(signatureInfo, signature, sellerErc20.address);

                const feeAmount = feePercentage.mul(amountOfErc20).div(10000);
                const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address
                );
                const royaltyAmount = amountOfErc20.mul(royaltyInfo[1]).div(10000);
                expect(await tokenInst.balanceOf(feeReceiver.address)).to.be.equals(feeAmount);
                expect(await tokenInst.balanceOf(buyerErc20.address)).to.be.equals(
                    amountOfErc20.sub(feeAmount).sub(royaltyAmount)
                );
                expect(await tokenInst.balanceOf(royaltyInfo[0])).to.be.equals(royaltyAmount);
                expect(
                    await erc1155OwnableInst.balanceOf(sellerErc20.address, idOfErc1155)
                ).to.be.equals(amountOfErc1155);

                expect(await nftMarketplaceInst.isOrderComplited(orderId)).to.be.true;
            });
        });
    });

    async function signInfo(user, info) {
        const encodedSignatureInfo = ethers.utils.defaultAbiCoder.encode(
            [
                "(address,address,(uint8,address,uint256,uint256),(uint8,address,uint256,uint256),uint256)",
            ],
            [info]
        );
        const orderId = ethers.utils.keccak256(ethers.utils.arrayify(encodedSignatureInfo));
        const signature = await user.signMessage(ethers.utils.arrayify(orderId));

        return [signature, orderId];
    }
});
