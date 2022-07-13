import { expect } from "chai";

import { BigNumber } from "ethers";
import { ethers, tracer } from "hardhat";
const { loadFixture, time, takeSnapshot } = require("@nomicfoundation/hardhat-network-helpers");

import {
    TokenType,
    AuctionData,
    ERC20Contract,
    ERC721Contract,
    ERC721WithERC2981Contract,
    ERC1155Contract,
    NftMarketplaceV2Contract,
    PrepareEnvironmentResult,
} from "./types";

import {
    tokenInfoToTokenInfoRaw,
    getAuctionId,
    compareAuctionDataWithRaw,
    tokenTypeToNumber,
} from "./helpers";

const Decimals = BigNumber.from(18);
const OneToken = BigNumber.from(10).pow(Decimals);
const OneEth = ethers.constants.WeiPerEther;

const Zero = BigNumber.from("0");
const One = BigNumber.from("1");
const Two = BigNumber.from("2");
const Ten = BigNumber.from("10");

const gasLimit = BigNumber.from("10000000");

const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;
const Bytes32Zero = ethers.constants.HashZero;

const OneHour = 3600;
const OneDay = 86400;

describe("NFT Marketplace V2 tests", function () {
    async function prepareEnvironment(): Promise<PrepareEnvironmentResult> {
        const [deployer, feeReceiver, feeReceiverERC2981, user1, user2, user3] =
            await ethers.getSigners();
        tracer.nameTags[deployer.address] = "deployer";
        tracer.nameTags[feeReceiver.address] = "feeReceiver";
        tracer.nameTags[user1.address] = "user1";
        tracer.nameTags[user2.address] = "user2";
        tracer.nameTags[user3.address] = "user3";

        const TestERC20Factory = await ethers.getContractFactory("TestERC20");
        const tokenInst = <ERC20Contract>await TestERC20Factory.deploy();
        tracer.nameTags[tokenInst.address] = "tokenInst";

        //TestERC20TransferWithoutResult
        const TestERC20TransferWithoutResultFactory = await ethers.getContractFactory(
            "TestERC20TransferWithoutResult"
        );
        const tokenTransferWithoutResultInst = <ERC20Contract>(
            await TestERC20TransferWithoutResultFactory.deploy("Test", "TEST")
        );
        tracer.nameTags[tokenTransferWithoutResultInst.address] = "tokenTransferWithoutResultInst";

        const TestERC721Factory = await ethers.getContractFactory("TestERC721");
        const erc721Inst = <ERC721Contract>await TestERC721Factory.deploy();
        tracer.nameTags[erc721Inst.address] = "erc721Inst";

        const TestERC721OwnableFactory = await ethers.getContractFactory("TestERC721Ownable");
        const erc721OwnableInst = <ERC721Contract>await TestERC721OwnableFactory.deploy();
        tracer.nameTags[erc721OwnableInst.address] = "erc721OwnableInst";

        const TestERC721WithERC2981Factory = await ethers.getContractFactory(
            "TestERC721WithERC2981"
        );
        const erc721WithERC2981Inst = <ERC721WithERC2981Contract>(
            await TestERC721WithERC2981Factory.deploy()
        );
        tracer.nameTags[erc721WithERC2981Inst.address] = "erc721WithERC2981Inst";
        await erc721WithERC2981Inst.setReceiver(feeReceiverERC2981.address);

        const TestERC1155Factory = await ethers.getContractFactory("TestERC1155");
        const erc1155Inst = <ERC1155Contract>await TestERC1155Factory.deploy();
        tracer.nameTags[erc1155Inst.address] = "erc1155Inst";

        const TestERC1155OwnableFactory = await ethers.getContractFactory("TestERC1155Ownable");
        const erc1155OwnableInst = <ERC1155Contract>await TestERC1155OwnableFactory.deploy();
        tracer.nameTags[erc1155OwnableInst.address] = "erc1155OwnableInst";

        const NftMarketplaceFactory = await ethers.getContractFactory("NftMarketplaceV2");
        const nftMarketplaceInst = <NftMarketplaceV2Contract>(
            await NftMarketplaceFactory.deploy(feeReceiver.address)
        );
        tracer.nameTags[nftMarketplaceInst.address] = "nftMarketplaceInst";

        const feePercentage = await nftMarketplaceInst.feePercentage();
        const defaultFeeForOwner = await nftMarketplaceInst.defaultFeeForOwner();
        const defaultERC2981Fee = await erc721WithERC2981Inst.defaultFee();

        const timestampNow = await time.latest();

        return {
            tokenInst,
            tokenTransferWithoutResultInst,
            erc721Inst,
            erc721OwnableInst,
            erc721WithERC2981Inst,
            erc1155Inst,
            erc1155OwnableInst,

            nftMarketplaceInst,

            deployer,
            feeReceiver,
            feeReceiverERC2981,
            user1,
            user2,
            user3,
            timestampNow,
            feePercentage,
            defaultFeeForOwner,
            defaultERC2981Fee,
        };
    }

    it("Deploy test", async () => {
        const { nftMarketplaceInst, feeReceiver } = <PrepareEnvironmentResult>(
            await loadFixture(prepareEnvironment)
        );
        expect(await nftMarketplaceInst.feeReceiver()).equals(feeReceiver.address);
        expect(await nftMarketplaceInst.isPausedCreation()).false;
    });

    it("ERC165 check", async () => {
        const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
            await loadFixture(prepareEnvironment)
        );

        expect(await nftMarketplaceInst.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165 interface id
        expect(await nftMarketplaceInst.supportsInterface("0x4e2312e0")).to.be.true; // IERC1155Receiver interface id
        expect(await nftMarketplaceInst.supportsInterface("0x7965db0b")).to.be.true; // IAccessControl interface id
        expect(await nftMarketplaceInst.supportsInterface("0x5a05180f")).to.be.true; // IAccessControlEnumerable interface id
    });

    describe("Auctions", () => {
        it("Auction creation test", async () => {
            const { nftMarketplaceInst, erc721Inst, timestampNow, user1, tokenInst } = <
                PrepareEnvironmentResult
            >await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // create auction
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            // check owner of NFT
            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).equals(
                nftMarketplaceInst.address
            );

            // check storage variables
            const auctionId = getAuctionId(auctionData);
            expect(await nftMarketplaceInst.activeAuctionsLength()).equals(1);
            expect(await nftMarketplaceInst.activeAuctionsAt(0)).equals(auctionId);
            expect(await nftMarketplaceInst.activeAuctionsContains(auctionId)).true;

            const auctionDataFetch = await nftMarketplaceInst.auctionData(auctionId);
            compareAuctionDataWithRaw(auctionData, auctionDataFetch);

            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).false;
        });

        it("Swap ERC721 to native", async () => {
            const {
                nftMarketplaceInst,
                erc721Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: AddressZero,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst
                .connect(user2)
                .bid(auctionId, auctionData.minPrice, { value: auctionData.minPrice });

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

            // second bid
            const endPrice = auctionData.minPrice.mul(2);
            await nftMarketplaceInst.connect(user3).bid(auctionId, auctionData.minPrice.mul(2), {
                value: endPrice,
            });

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice.mul(2);
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await ethers.provider.getBalance(user1.address);
            const user3EthBalanceBefore = await ethers.provider.getBalance(user3.address);
            const feeReceiverEthBalanceBefore = await ethers.provider.getBalance(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceBefore = await ethers.provider.getBalance(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(user3.address);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await ethers.provider.getBalance(user1.address);
            const user3EthBalanceAfter = await ethers.provider.getBalance(user3.address);
            const feeReceiverEthBalanceAfter = await ethers.provider.getBalance(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceAfter = await ethers.provider.getBalance(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC721 to ERC20", async () => {
            const {
                nftMarketplaceInst,
                erc721Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.minPrice);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenInst.connect(user3).mint(endPrice);
            await tokenInst.connect(user3).approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceBefore = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceBefore = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceBefore = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(user3.address);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceAfter = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceAfter = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceAfter = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC721 to ERC20 that doesn't return bool in transfers", async () => {
            const {
                nftMarketplaceInst,
                erc721Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenTransferWithoutResultInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenTransferWithoutResultInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenTransferWithoutResultInst.connect(user2).mint(auctionData.minPrice);
            await tokenTransferWithoutResultInst
                .connect(user2)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenTransferWithoutResultInst.connect(user3).mint(endPrice);
            await tokenTransferWithoutResultInst
                .connect(user3)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user1.address
            );
            const user3EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user3.address
            );
            const feeReceiverEthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(user3.address);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user1.address
            );
            const user3EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user3.address
            );
            const feeReceiverEthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC721 with ERC2981 to ERC20", async () => {
            const {
                nftMarketplaceInst,
                erc721WithERC2981Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721WithERC2981Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721WithERC2981Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721WithERC2981Inst
                .connect(user1)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.minPrice);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenInst.connect(user3).mint(endPrice);
            await tokenInst.connect(user3).approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceBefore = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceBefore = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceBefore = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721WithERC2981Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                user3.address
            );

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceAfter = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceAfter = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceAfter = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC721 with ERC2981 that returns bad values to ERC20", async () => {
            const {
                nftMarketplaceInst,
                erc721WithERC2981Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721WithERC2981Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721WithERC2981Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721WithERC2981Inst
                .connect(user1)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.minPrice);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenInst.connect(user3).mint(endPrice);
            await tokenInst.connect(user3).approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceBefore = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceBefore = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceBefore = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await erc721WithERC2981Inst.returnBadValue();
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721WithERC2981Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                user3.address
            );

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceAfter = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceAfter = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceAfter = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(endPrice.div(2)).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                endPrice.div(2)
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC1155 to native", async () => {
            const {
                nftMarketplaceInst,
                erc1155Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC1155,
                    tokenAddress: erc1155Inst.address,
                    id: One,
                    amount: Ten,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: AddressZero,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst
                .connect(user2)
                .bid(auctionId, auctionData.minPrice, { value: auctionData.minPrice });

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

            // second bid
            const endPrice = auctionData.minPrice.mul(2);
            await nftMarketplaceInst.connect(user3).bid(auctionId, auctionData.minPrice.mul(2), {
                value: endPrice,
            });

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await ethers.provider.getBalance(user1.address);
            const user3EthBalanceBefore = await ethers.provider.getBalance(user3.address);
            const feeReceiverEthBalanceBefore = await ethers.provider.getBalance(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceBefore = await ethers.provider.getBalance(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(
                await erc1155Inst.balanceOf(user3.address, auctionData.tokenInfo.id)
            ).to.be.equals(auctionData.tokenInfo.amount);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await ethers.provider.getBalance(user1.address);
            const user3EthBalanceAfter = await ethers.provider.getBalance(user3.address);
            const feeReceiverEthBalanceAfter = await ethers.provider.getBalance(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceAfter = await ethers.provider.getBalance(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC1155 to ERC20", async () => {
            const {
                nftMarketplaceInst,
                erc1155Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC1155,
                    tokenAddress: erc1155Inst.address,
                    id: One,
                    amount: Ten,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.minPrice);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenInst.connect(user3).mint(endPrice);
            await tokenInst.connect(user3).approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceBefore = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceBefore = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceBefore = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(
                await erc1155Inst.balanceOf(user3.address, auctionData.tokenInfo.id)
            ).to.be.equals(auctionData.tokenInfo.amount);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenInst.balanceOf(user1.address);
            const user3EthBalanceAfter = await tokenInst.balanceOf(user3.address);
            const feeReceiverEthBalanceAfter = await tokenInst.balanceOf(feeReceiver.address);
            const royaltyReceiverEthBalanceAfter = await tokenInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Swap ERC1155 to ERC20 that doesn't return bool in transfers", async () => {
            const {
                nftMarketplaceInst,
                erc1155Inst,
                timestampNow,
                user1,
                user2,
                user3,
                feePercentage,
                feeReceiver,
                tokenTransferWithoutResultInst,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC1155,
                    tokenAddress: erc1155Inst.address,
                    id: One,
                    amount: Ten,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenTransferWithoutResultInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenTransferWithoutResultInst.connect(user2).mint(auctionData.minPrice);
            await tokenTransferWithoutResultInst
                .connect(user2)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.minPrice.mul(2);
            await tokenTransferWithoutResultInst.connect(user3).mint(endPrice);
            await tokenTransferWithoutResultInst
                .connect(user3)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.minPrice);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = auctionData.minPrice;
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(auctionData.minPrice);

            // get info about royalties and balances before execution of the auction
            const royaltyInfo = await nftMarketplaceInst.getRoyaltyInfo(
                auctionData.tokenInfo.tokenAddress,
                auctionData.tokenInfo.id,
                endPrice
            );

            const user1EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user1.address
            );
            const user3EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user3.address
            );
            const feeReceiverEthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );

            // process auction
            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(
                await erc1155Inst.balanceOf(user3.address, auctionData.tokenInfo.id)
            ).to.be.equals(auctionData.tokenInfo.amount);

            // check balance changes and fees
            const nftMarketplaceFeeAmount = endPrice.mul(feePercentage).div(10000);

            const user1EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user1.address
            );
            const user3EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user3.address
            );
            const feeReceiverEthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                feeReceiver.address
            );
            const royaltyReceiverEthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                royaltyInfo.royaltyReceiver
            );
            expect(user3EthBalanceAfter.sub(user3EthBalanceBefore)).equals(0);
            expect(user1EthBalanceAfter.sub(user1EthBalanceBefore)).equals(
                endPrice.sub(royaltyInfo.royaltyAmount).sub(nftMarketplaceFeeAmount)
            );
            expect(feeReceiverEthBalanceAfter.sub(feeReceiverEthBalanceBefore)).equals(
                nftMarketplaceFeeAmount
            );
            expect(royaltyReceiverEthBalanceAfter.sub(royaltyReceiverEthBalanceBefore)).equals(
                royaltyInfo.royaltyAmount
            );

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Auction ERC721 with no bids", async () => {
            const { nftMarketplaceInst, erc721Inst, timestampNow, user1, tokenInst } = <
                PrepareEnvironmentResult
            >await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC721,
                    tokenAddress: erc721Inst.address,
                    id: One,
                    amount: Zero,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(user1.address);

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        it("Auction ERC1155 with no bids", async () => {
            const { nftMarketplaceInst, erc1155Inst, timestampNow, user1, tokenInst } = <
                PrepareEnvironmentResult
            >await loadFixture(prepareEnvironment);

            // set parameters for auction
            const auctionData: AuctionData = {
                tokenInfo: {
                    tokenType: TokenType.ERC1155,
                    tokenAddress: erc1155Inst.address,
                    id: One,
                    amount: Ten,
                },
                seller: user1.address,
                startTime: timestampNow + OneHour,
                endTime: timestampNow + OneHour + OneDay,
                minPrice: OneToken.mul(10),
                bidToken: tokenInst.address,
                lastBidAmount: Zero,
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // create auction
            const auctionId = getAuctionId(auctionData);
            await nftMarketplaceInst
                .connect(user1)
                .createAuction(
                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                    auctionData.startTime,
                    auctionData.endTime,
                    auctionData.minPrice,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.endTime);
            await nftMarketplaceInst.endAuction(auctionId);

            // check new owner of NFT
            expect(
                await erc1155Inst.balanceOf(user1.address, auctionData.tokenInfo.id)
            ).to.be.equals(auctionData.tokenInfo.amount);

            // check global variables
            expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                AddressZero
            );
            expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
            expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(0);
        });

        describe("Reverts", () => {
            describe("{createAuction} function", () => {
                it("Should revert in case of pause", async () => {
                    const { nftMarketplaceInst, erc721Inst, erc1155Inst, timestampNow } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    await nftMarketplaceInst.togglePause();

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC20),
                                tokenAddress: AddressZero,
                                id: Zero,
                                amount: Zero,
                            },
                            0,
                            0,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Creation paused");
                });

                it("Should revert in case of a bad tokenInfo", async () => {
                    const { nftMarketplaceInst, erc721Inst, erc1155Inst, timestampNow } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC20),
                                tokenAddress: AddressZero,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Only NFT");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: AddressZero,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Not a contract");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: AddressZero,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Not a contract");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc1155Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: ERC721 type");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC1155),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: ERC1155 type");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: One,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: ERC721 amount");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC1155),
                                tokenAddress: erc1155Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: ERC1155 amount");
                });

                it("Should revert in case of a bad start/end time", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow + OneDay,
                            timestampNow + OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Wrong start/end time");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow - OneDay,
                            timestampNow - OneHour,
                            Zero,
                            AddressZero
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Wrong start/end time");
                });

                it("Should revert in case of a bad bid token info", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow + OneHour,
                            timestampNow + OneDay,
                            Zero,
                            user1.address
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: bidToken is not a contract");

                    await expect(
                        nftMarketplaceInst.createAuction(
                            {
                                tokenType: tokenTypeToNumber(TokenType.ERC721),
                                tokenAddress: erc721Inst.address,
                                id: Zero,
                                amount: Zero,
                            },
                            timestampNow + OneHour,
                            timestampNow + OneDay,
                            Zero,
                            nftMarketplaceInst.address
                        )
                    ).to.be.revertedWithoutReason();
                });

                it("Should revert in case of double creation", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, deployer } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    const auctionData: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: One,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    const auctionId = getAuctionId(auctionData);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                            auctionData.startTime,
                            auctionData.endTime,
                            auctionData.minPrice,
                            auctionData.bidToken
                        );

                    //await erc721Inst.testTransfersToggle();

                    await expect(
                        nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.minPrice,
                                auctionData.bidToken
                            )
                    ).to.be.revertedWith("NftMarketplaceV2: Existing auction");

                    await nftMarketplaceInst
                        .connect(deployer)
                        .deleteAuction(auctionId, true, false, true, false);

                    await expect(
                        nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.minPrice,
                                auctionData.bidToken
                            )
                    ).to.be.revertedWith("NftMarketplaceV2: Auction is completed");
                });
            });

            describe("{bid} function", () => {
                it("Should revert in case of a bid to not active order", async () => {
                    const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironment)
                    );

                    await expect(nftMarketplaceInst.bid(Bytes32Zero, Zero)).to.be.revertedWith(
                        "NftMarketplaceV2: No such open auction"
                    );
                });

                it("Should revert in case of a bad bid time", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    const auctionData: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: One,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    const auctionId = getAuctionId(auctionData);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                            auctionData.startTime,
                            auctionData.endTime,
                            auctionData.minPrice,
                            auctionData.bidToken
                        );

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.minPrice, { value: auctionData.minPrice })
                    ).to.be.revertedWith("NftMarketplaceV2: Auction is not started");

                    await time.increaseTo(auctionData.endTime);

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.minPrice, { value: auctionData.minPrice })
                    ).to.be.revertedWith("NftMarketplaceV2: Auction has ended");
                });

                it("Should revert in case of a bad amount", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    const auctionData1: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: One,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };
                    const auctionData2: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: Two,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: Zero,
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData1.tokenInfo.id);
                    await erc721Inst.connect(user1).mint(auctionData2.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    const auctionId1 = getAuctionId(auctionData1);
                    const auctionId2 = getAuctionId(auctionData2);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData1.tokenInfo),
                            auctionData1.startTime,
                            auctionData1.endTime,
                            auctionData1.minPrice,
                            auctionData1.bidToken
                        );
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData2.tokenInfo),
                            auctionData2.startTime,
                            auctionData2.endTime,
                            auctionData2.minPrice,
                            auctionData2.bidToken
                        );

                    await time.increaseTo(auctionData1.startTime);

                    // test auction 1
                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId1, auctionData1.minPrice.sub(1), {
                                value: auctionData1.minPrice.sub(1),
                            })
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    await nftMarketplaceInst
                        .connect(user2)
                        .bid(auctionId1, auctionData1.minPrice, { value: auctionData1.minPrice });

                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId1, auctionData1.minPrice, {
                            value: auctionData1.minPrice,
                        })
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    // test auction 2 zero amount
                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId2, Zero)
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");
                });

                it("Should revert in case of a bad value (ETH attached to the call)", async () => {
                    const {
                        nftMarketplaceInst,
                        erc721Inst,
                        timestampNow,
                        user1,
                        user2,
                        tokenInst,
                    } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                    const auctionData1: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: One,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };
                    const auctionData2: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: Two,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: tokenInst.address,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData1.tokenInfo.id);
                    await erc721Inst.connect(user1).mint(auctionData2.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    const auctionId1 = getAuctionId(auctionData1);
                    const auctionId2 = getAuctionId(auctionData2);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData1.tokenInfo),
                            auctionData1.startTime,
                            auctionData1.endTime,
                            auctionData1.minPrice,
                            auctionData1.bidToken
                        );
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData2.tokenInfo),
                            auctionData2.startTime,
                            auctionData2.endTime,
                            auctionData2.minPrice,
                            auctionData2.bidToken
                        );

                    await time.increaseTo(auctionData1.startTime);

                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId1, auctionData1.minPrice, {
                            value: auctionData1.minPrice.sub(1),
                        })
                    ).to.be.revertedWith("NftMarketplaceV2: Wrong amount");
                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId1, auctionData1.minPrice, {
                            value: auctionData1.minPrice.add(1),
                        })
                    ).to.be.revertedWith("NftMarketplaceV2: Wrong amount");

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId2, auctionData1.minPrice, { value: One })
                    ).to.be.revertedWith("NftMarketplaceV2: Not native, need no value");
                });
            });

            describe("{endAuction} function", async () => {
                it("Should revert in case of a not active order", async () => {
                    const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironment)
                    );

                    await expect(nftMarketplaceInst.endAuction(Bytes32Zero)).to.be.revertedWith(
                        "NftMarketplaceV2: No such open auction"
                    );
                });

                it("Should revert in case of a bad time", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironment);

                    const auctionData: AuctionData = {
                        tokenInfo: {
                            tokenType: TokenType.ERC721,
                            tokenAddress: erc721Inst.address,
                            id: One,
                            amount: Zero,
                        },
                        seller: user1.address,
                        startTime: timestampNow + OneHour,
                        endTime: timestampNow + OneHour + OneDay,
                        minPrice: OneToken.mul(10),
                        bidToken: AddressZero,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    const auctionId = getAuctionId(auctionData);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                            auctionData.startTime,
                            auctionData.endTime,
                            auctionData.minPrice,
                            auctionData.bidToken
                        );

                    await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                        "NftMarketplaceV2: Not ended yet"
                    );

                    await time.increaseTo(auctionData.startTime);

                    await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                        "NftMarketplaceV2: Not ended yet"
                    );

                    // middle of an auction
                    await time.increaseTo(
                        auctionData.startTime + (auctionData.endTime - auctionData.startTime) / 2
                    );

                    await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                        "NftMarketplaceV2: Not ended yet"
                    );

                    await time.increaseTo(auctionData.endTime - 10);

                    await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                        "NftMarketplaceV2: Not ended yet"
                    );
                });
            });
        });
    });

    describe("Admin functions", () => {
        it("Check initial roles", async () => {
            const { nftMarketplaceInst, deployer } = <PrepareEnvironmentResult>(
                await loadFixture(prepareEnvironment)
            );

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, deployer.address)).to.be.true;
            expect(await nftMarketplaceInst.getRoleMemberCount(Bytes32Zero)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(Bytes32Zero, 0)).to.be.equals(
                deployer.address
            );
        });

        it("{setFeePercentage} function", async () => {
            const { nftMarketplaceInst, feePercentage, deployer, user1 } = <
                PrepareEnvironmentResult
            >await loadFixture(prepareEnvironment);

            await expect(
                nftMarketplaceInst.connect(deployer).setFeePercentage(feePercentage)
            ).to.be.revertedWith("NftMarketplaceV2: No change");
            await expect(
                nftMarketplaceInst.connect(deployer).setFeePercentage(10_01)
            ).to.be.revertedWith("NftMarketplaceV2: Too big percentage");
            await expect(
                nftMarketplaceInst.connect(user1).setFeePercentage(10_00)
            ).to.be.revertedWith(
                "AccessControl: account " +
                    user1.address.toLowerCase() +
                    " is missing role " +
                    Bytes32Zero
            );

            const newValue = 10_00;
            await nftMarketplaceInst.connect(deployer).setFeePercentage(newValue);
            expect(await nftMarketplaceInst.feePercentage()).to.be.equals(newValue);
        });

        it("{setFeeReceiver} function", async () => {
            const { nftMarketplaceInst, feeReceiver, deployer, user1 } = <PrepareEnvironmentResult>(
                await loadFixture(prepareEnvironment)
            );

            await expect(
                nftMarketplaceInst.connect(deployer).setFeeReceiver(feeReceiver.address)
            ).to.be.revertedWith("NftMarketplaceV2: No change");
            await expect(
                nftMarketplaceInst.connect(deployer).setFeeReceiver(AddressZero)
            ).to.be.revertedWith("NftMarketplaceV2: Zero address");

            const newValue = deployer.address;
            await expect(
                nftMarketplaceInst.connect(user1).setFeeReceiver(newValue)
            ).to.be.revertedWith(
                "AccessControl: account " +
                    user1.address.toLowerCase() +
                    " is missing role " +
                    Bytes32Zero
            );

            await nftMarketplaceInst.connect(deployer).setFeeReceiver(newValue);
            expect(await nftMarketplaceInst.feeReceiver()).to.be.equals(newValue);
        });

        it("{togglePause} function", async () => {
            const { nftMarketplaceInst, feeReceiver, deployer, user1 } = <PrepareEnvironmentResult>(
                await loadFixture(prepareEnvironment)
            );

            expect(await nftMarketplaceInst.isPausedCreation()).to.be.false;
            await expect(nftMarketplaceInst.connect(user1).togglePause()).to.be.revertedWith(
                "AccessControl: account " +
                    user1.address.toLowerCase() +
                    " is missing role " +
                    Bytes32Zero
            );

            await nftMarketplaceInst.connect(deployer).togglePause();
            expect(await nftMarketplaceInst.isPausedCreation()).to.be.true;
        });

        describe("{deleteAuction} function", () => {
            it("Reverts", async () => {
                const { nftMarketplaceInst, deployer, user1 } = <PrepareEnvironmentResult>(
                    await loadFixture(prepareEnvironment)
                );

                await expect(
                    nftMarketplaceInst
                        .connect(user1)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        Bytes32Zero
                );

                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith("NftMarketplaceV2: No such open auction");
            });

            it("Auction without bids", async () => {
                const { nftMarketplaceInst, erc721Inst, timestampNow, user1 } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                // set parameters for auction
                const auctionData: AuctionData = {
                    tokenInfo: {
                        tokenType: TokenType.ERC721,
                        tokenAddress: erc721Inst.address,
                        id: One,
                        amount: Zero,
                    },
                    seller: user1.address,
                    startTime: timestampNow + OneHour,
                    endTime: timestampNow + OneHour + OneDay,
                    minPrice: OneToken.mul(10),
                    bidToken: AddressZero,
                    lastBidAmount: Zero,
                    lastBidder: AddressZero,
                };

                // mint NFT
                await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

                // create auction
                const auctionId = getAuctionId(auctionData);
                await nftMarketplaceInst
                    .connect(user1)
                    .createAuction(
                        tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                        auctionData.startTime,
                        auctionData.endTime,
                        auctionData.minPrice,
                        auctionData.bidToken
                    );

                await nftMarketplaceInst.deleteAuction(auctionId, true, false, true, false);

                expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                    user1.address
                );

                expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                    AddressZero
                );
                expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
                expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(Zero);
            });

            it("Auction with bids", async () => {
                const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                // set parameters for auction
                const auctionData: AuctionData = {
                    tokenInfo: {
                        tokenType: TokenType.ERC721,
                        tokenAddress: erc721Inst.address,
                        id: One,
                        amount: Zero,
                    },
                    seller: user1.address,
                    startTime: timestampNow + OneHour,
                    endTime: timestampNow + OneHour + OneDay,
                    minPrice: OneToken.mul(10),
                    bidToken: AddressZero,
                    lastBidAmount: Zero,
                    lastBidder: AddressZero,
                };

                // mint NFT
                await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

                // create auction
                const auctionId = getAuctionId(auctionData);
                await nftMarketplaceInst
                    .connect(user1)
                    .createAuction(
                        tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                        auctionData.startTime,
                        auctionData.endTime,
                        auctionData.minPrice,
                        auctionData.bidToken
                    );

                await time.increaseTo(auctionData.startTime);

                await nftMarketplaceInst
                    .connect(user2)
                    .bid(auctionId, auctionData.minPrice, { value: auctionData.minPrice });

                const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

                await nftMarketplaceInst.deleteAuction(auctionId, true, false, true, false);

                const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
                expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).to.be.equals(
                    auctionData.minPrice
                );

                expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                    user1.address
                );

                expect((await nftMarketplaceInst.auctionData(auctionId)).seller).to.be.equals(
                    AddressZero
                );
                expect(await nftMarketplaceInst.isAuctionCompleted(auctionId)).to.be.true;
                expect(await nftMarketplaceInst.activeAuctionsLength()).to.be.equals(Zero);
            });

            describe("Refunds in case of a bad token transfer", () => {
                describe("Bad NFT", () => {
                    describe("Bad ERC721", () => {
                        it("Transfer reverts", async () => {
                            const {
                                nftMarketplaceInst,
                                erc721Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                            // set parameters for auction
                            const auctionData: AuctionData = {
                                tokenInfo: {
                                    tokenType: TokenType.ERC721,
                                    tokenAddress: erc721Inst.address,
                                    id: One,
                                    amount: Zero,
                                },
                                seller: user1.address,
                                startTime: timestampNow + OneHour,
                                endTime: timestampNow + OneHour + OneDay,
                                minPrice: OneToken.mul(10),
                                bidToken: tokenInst.address,
                                lastBidAmount: Zero,
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                            await erc721Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.minPrice);
                            await tokenInst
                                .connect(user2)
                                .approve(nftMarketplaceInst.address, MaxUint256);

                            // create auction
                            const auctionId = getAuctionId(auctionData);
                            await nftMarketplaceInst
                                .connect(user1)
                                .createAuction(
                                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                    auctionData.startTime,
                                    auctionData.endTime,
                                    auctionData.minPrice,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.minPrice);

                            await erc721Inst.revertTransfers();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId)
                            ).to.be.revertedWith("ERC721 transfer revert");

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await nftMarketplaceInst.deleteAuction(
                                auctionId,
                                false,
                                false,
                                true,
                                false
                            );

                            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                                nftMarketplaceInst.address
                            );

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.minPrice);
                        });

                        it("Transfer gas ddos", async () => {
                            const {
                                nftMarketplaceInst,
                                erc721Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                            // set parameters for auction
                            const auctionData: AuctionData = {
                                tokenInfo: {
                                    tokenType: TokenType.ERC721,
                                    tokenAddress: erc721Inst.address,
                                    id: One,
                                    amount: Zero,
                                },
                                seller: user1.address,
                                startTime: timestampNow + OneHour,
                                endTime: timestampNow + OneHour + OneDay,
                                minPrice: OneToken.mul(10),
                                bidToken: tokenInst.address,
                                lastBidAmount: Zero,
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                            await erc721Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.minPrice);
                            await tokenInst
                                .connect(user2)
                                .approve(nftMarketplaceInst.address, MaxUint256);

                            // create auction
                            const auctionId = getAuctionId(auctionData);
                            await nftMarketplaceInst
                                .connect(user1)
                                .createAuction(
                                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                    auctionData.startTime,
                                    auctionData.endTime,
                                    auctionData.minPrice,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.minPrice);

                            await erc721Inst.unlimitedGasSpend();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId, {
                                    gasLimit: gasLimit,
                                })
                            ).to.be.reverted;

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await expect(
                                nftMarketplaceInst.deleteAuction(
                                    auctionId,
                                    true,
                                    false,
                                    true,
                                    false,
                                    {
                                        gasLimit: gasLimit,
                                    }
                                )
                            ).to.be.reverted;

                            await nftMarketplaceInst.deleteAuction(
                                auctionId,
                                false,
                                true,
                                true,
                                false
                            );

                            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                                nftMarketplaceInst.address
                            );

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.minPrice);
                        });
                    });

                    describe("Bad ERC1155", () => {
                        it("Transfer reverts", async () => {
                            const {
                                nftMarketplaceInst,
                                erc1155Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                            // set parameters for auction
                            const auctionData: AuctionData = {
                                tokenInfo: {
                                    tokenType: TokenType.ERC1155,
                                    tokenAddress: erc1155Inst.address,
                                    id: One,
                                    amount: Ten,
                                },
                                seller: user1.address,
                                startTime: timestampNow + OneHour,
                                endTime: timestampNow + OneHour + OneDay,
                                minPrice: OneToken.mul(10),
                                bidToken: tokenInst.address,
                                lastBidAmount: Zero,
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc1155Inst
                                .connect(user1)
                                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
                            await erc1155Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.minPrice);
                            await tokenInst
                                .connect(user2)
                                .approve(nftMarketplaceInst.address, MaxUint256);

                            // create auction
                            const auctionId = getAuctionId(auctionData);
                            await nftMarketplaceInst
                                .connect(user1)
                                .createAuction(
                                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                    auctionData.startTime,
                                    auctionData.endTime,
                                    auctionData.minPrice,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.minPrice);

                            await erc1155Inst.revertTransfers();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId)
                            ).to.be.revertedWith("ERC1155 transfer revert");

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await nftMarketplaceInst.deleteAuction(
                                auctionId,
                                false,
                                false,
                                true,
                                false
                            );

                            expect(
                                await erc1155Inst.balanceOf(
                                    nftMarketplaceInst.address,
                                    auctionData.tokenInfo.id
                                )
                            ).to.be.equals(auctionData.tokenInfo.amount);

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.minPrice);
                        });

                        it("Transfer gas ddos", async () => {
                            const {
                                nftMarketplaceInst,
                                erc1155Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                            // set parameters for auction
                            const auctionData: AuctionData = {
                                tokenInfo: {
                                    tokenType: TokenType.ERC1155,
                                    tokenAddress: erc1155Inst.address,
                                    id: One,
                                    amount: Ten,
                                },
                                seller: user1.address,
                                startTime: timestampNow + OneHour,
                                endTime: timestampNow + OneHour + OneDay,
                                minPrice: OneToken.mul(10),
                                bidToken: tokenInst.address,
                                lastBidAmount: Zero,
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc1155Inst
                                .connect(user1)
                                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
                            await erc1155Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.minPrice);
                            await tokenInst
                                .connect(user2)
                                .approve(nftMarketplaceInst.address, MaxUint256);

                            // create auction
                            const auctionId = getAuctionId(auctionData);
                            await nftMarketplaceInst
                                .connect(user1)
                                .createAuction(
                                    tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                    auctionData.startTime,
                                    auctionData.endTime,
                                    auctionData.minPrice,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.minPrice);

                            await erc1155Inst.unlimitedGasSpend();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId, {
                                    gasLimit: gasLimit,
                                })
                            ).to.be.reverted;

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await expect(
                                nftMarketplaceInst.deleteAuction(
                                    auctionId,
                                    true,
                                    false,
                                    true,
                                    false,
                                    {
                                        gasLimit: gasLimit,
                                    }
                                )
                            ).to.be.reverted;

                            await nftMarketplaceInst.deleteAuction(
                                auctionId,
                                false,
                                true,
                                true,
                                false
                            );

                            expect(
                                await erc1155Inst.balanceOf(
                                    nftMarketplaceInst.address,
                                    auctionData.tokenInfo.id
                                )
                            ).to.be.equals(auctionData.tokenInfo.amount);

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.minPrice);
                        });
                    });
                });

                describe("Bad ERC20", () => {
                    it("Transfer returns false", async () => {
                        const {
                            nftMarketplaceInst,
                            erc721Inst,
                            timestampNow,
                            user1,
                            user2,
                            tokenInst,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                        // set parameters for auction
                        const auctionData: AuctionData = {
                            tokenInfo: {
                                tokenType: TokenType.ERC721,
                                tokenAddress: erc721Inst.address,
                                id: One,
                                amount: Zero,
                            },
                            seller: user1.address,
                            startTime: timestampNow + OneHour,
                            endTime: timestampNow + OneHour + OneDay,
                            minPrice: OneToken.mul(10),
                            bidToken: tokenInst.address,
                            lastBidAmount: Zero,
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.minPrice);
                        await tokenInst
                            .connect(user2)
                            .approve(nftMarketplaceInst.address, MaxUint256);

                        // create auction
                        const auctionId = getAuctionId(auctionData);
                        await nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.minPrice,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.minPrice);

                        await tokenInst.returnTransferFalse();

                        await time.increaseTo(auctionData.endTime);
                        await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                            "NftMarketplaceV2: ERC20 transfer result false"
                        );

                        await nftMarketplaceInst.deleteAuction(
                            auctionId,
                            true,
                            false,
                            false,
                            false
                        );

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.minPrice
                        );
                    });

                    it("Transfer reverts", async () => {
                        const {
                            nftMarketplaceInst,
                            erc721Inst,
                            timestampNow,
                            user1,
                            user2,
                            tokenInst,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                        // set parameters for auction
                        const auctionData: AuctionData = {
                            tokenInfo: {
                                tokenType: TokenType.ERC721,
                                tokenAddress: erc721Inst.address,
                                id: One,
                                amount: Zero,
                            },
                            seller: user1.address,
                            startTime: timestampNow + OneHour,
                            endTime: timestampNow + OneHour + OneDay,
                            minPrice: OneToken.mul(10),
                            bidToken: tokenInst.address,
                            lastBidAmount: Zero,
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.minPrice);
                        await tokenInst
                            .connect(user2)
                            .approve(nftMarketplaceInst.address, MaxUint256);

                        // create auction
                        const auctionId = getAuctionId(auctionData);
                        await nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.minPrice,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.minPrice);

                        await tokenInst.revertTransfers();

                        await time.increaseTo(auctionData.endTime);
                        await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                            "ERC20 transfer revert"
                        );

                        await nftMarketplaceInst.deleteAuction(
                            auctionId,
                            true,
                            false,
                            false,
                            false
                        );

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.minPrice
                        );
                    });

                    it("Transfer gas ddos", async () => {
                        const {
                            nftMarketplaceInst,
                            erc721Inst,
                            timestampNow,
                            user1,
                            user2,
                            tokenInst,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                        // set parameters for auction
                        const auctionData: AuctionData = {
                            tokenInfo: {
                                tokenType: TokenType.ERC721,
                                tokenAddress: erc721Inst.address,
                                id: One,
                                amount: Zero,
                            },
                            seller: user1.address,
                            startTime: timestampNow + OneHour,
                            endTime: timestampNow + OneHour + OneDay,
                            minPrice: OneToken.mul(10),
                            bidToken: tokenInst.address,
                            lastBidAmount: Zero,
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.minPrice);
                        await tokenInst
                            .connect(user2)
                            .approve(nftMarketplaceInst.address, MaxUint256);

                        // create auction
                        const auctionId = getAuctionId(auctionData);
                        await nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.minPrice,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.minPrice);

                        await tokenInst.unlimitedGasSpend();

                        await time.increaseTo(auctionData.endTime);
                        await expect(
                            nftMarketplaceInst.endAuction(auctionId, {
                                gasLimit: gasLimit,
                            })
                        ).to.be.reverted;

                        await nftMarketplaceInst.deleteAuction(
                            auctionId,
                            true,
                            false,
                            false,
                            true,
                            { gasLimit: gasLimit }
                        );

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.minPrice
                        );
                    });
                });
            });
        });
    });

    describe("Royalties", () => {
        describe("Admin functions", () => {
            it("{setRoyalty} function", async () => {
                const { nftMarketplaceInst, deployer, user1, user2, erc721Inst, erc1155Inst } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                await expect(
                    nftMarketplaceInst.connect(user1).setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        Bytes32Zero
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Not a contract");
                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .setRoyalty(nftMarketplaceInst.address, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Wrong interface");
                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .setRoyalty(erc721Inst.address, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Percentage");
                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .setRoyalty(erc721Inst.address, AddressZero, 10_01)
                ).to.be.revertedWith("RoyaltiesInfo: Percentage");
                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .setRoyalty(erc721Inst.address, AddressZero, 10_00)
                ).to.be.revertedWith("RoyaltiesInfo: royaltyReceiver");

                await nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc721Inst.address, user1.address, One);
                await nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc1155Inst.address, user2.address, Two);

                const erc721Info = await nftMarketplaceInst.royaltiesInfo(erc721Inst.address);
                expect(erc721Info.isEnabled).to.be.true;
                expect(erc721Info.royaltyPercentage).to.be.equals(One);
                expect(erc721Info.royaltyReceiver).to.be.equals(user1.address);

                const erc1155Info = await nftMarketplaceInst.royaltiesInfo(erc1155Inst.address);
                expect(erc1155Info.isEnabled).to.be.true;
                expect(erc1155Info.royaltyPercentage).to.be.equals(Two);
                expect(erc1155Info.royaltyReceiver).to.be.equals(user2.address);
            });

            it("{setDefaultFeeForOwner} function", async () => {
                const { nftMarketplaceInst, deployer, user1, defaultFeeForOwner } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                await expect(
                    nftMarketplaceInst.connect(user1).setDefaultFeeForOwner(Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        Bytes32Zero
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).setDefaultFeeForOwner(10_01)
                ).to.be.revertedWith("NftMarketplace: Too big percent");
                await expect(
                    nftMarketplaceInst.connect(deployer).setDefaultFeeForOwner(defaultFeeForOwner)
                ).to.be.revertedWith("NftMarketplace: No change");

                const newValue = 10;
                await nftMarketplaceInst.connect(deployer).setDefaultFeeForOwner(newValue);

                expect(await nftMarketplaceInst.defaultFeeForOwner()).to.be.equals(newValue);
            });

            it("{disableAdminRoyalty} function", async () => {
                const { nftMarketplaceInst, deployer, user1, erc721Inst } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                await expect(
                    nftMarketplaceInst.connect(user1).disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        Bytes32Zero
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith("RoyaltiesInfo: Disabled");

                await nftMarketplaceInst
                    .connect(deployer)
                    .setRoyalty(erc721Inst.address, user1.address, 10);
                await nftMarketplaceInst.connect(deployer).disableAdminRoyalty(erc721Inst.address);

                const info = await nftMarketplaceInst.royaltiesInfo(erc721Inst.address);
                expect(info.isEnabled).to.be.false;
                expect(info.royaltyPercentage).to.be.equals(Zero);
                expect(info.royaltyReceiver).to.be.equals(AddressZero);
            });
        });

        describe("{getRoyaltyInfo} function", async () => {
            it("Without royalty info", async () => {
                const { nftMarketplaceInst, erc721Inst } = <PrepareEnvironmentResult>(
                    await loadFixture(prepareEnvironment)
                );

                const result = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721Inst.address,
                    Zero,
                    OneEth
                );
                expect(result.royaltyAmount).to.be.equals(Zero);
                expect(result.royaltyReceiver).to.be.equals(AddressZero);
            });

            it("With admin info", async () => {
                const { nftMarketplaceInst, erc721Inst, user1 } = <PrepareEnvironmentResult>(
                    await loadFixture(prepareEnvironment)
                );

                const royaltyPercentage = 100;
                await nftMarketplaceInst.setRoyalty(
                    erc721Inst.address,
                    user1.address,
                    royaltyPercentage
                );

                const price = OneEth;
                const result = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721Inst.address,
                    Zero,
                    price
                );
                expect(result.royaltyAmount).to.be.equals(price.mul(royaltyPercentage).div(10000));
                expect(result.royaltyReceiver).to.be.equals(user1.address);
            });

            it("With owner info", async () => {
                const { nftMarketplaceInst, erc721OwnableInst, deployer, defaultFeeForOwner } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironment);

                const price = OneEth;
                const result = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address,
                    Zero,
                    price
                );
                expect(result.royaltyAmount).to.be.equals(
                    price.mul(defaultFeeForOwner).div(100_00)
                );
                expect(result.royaltyReceiver).to.be.equals(deployer.address);
            });

            it("With ERC2981 info", async () => {
                const {
                    nftMarketplaceInst,
                    erc721WithERC2981Inst,
                    feeReceiverERC2981,
                    defaultERC2981Fee,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                const price = OneEth;
                const result = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721WithERC2981Inst.address,
                    Zero,
                    price
                );
                expect(result.royaltyAmount).to.be.equals(price.mul(defaultERC2981Fee).div(100_00));
                expect(result.royaltyReceiver).to.be.equals(feeReceiverERC2981.address);
            });

            it("Order info for ERC2981", async () => {
                const {
                    nftMarketplaceInst,
                    erc721WithERC2981Inst,
                    user2,
                    defaultERC2981Fee,
                    feeReceiverERC2981,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                const newRoyalty = 8_00;
                await nftMarketplaceInst.setRoyalty(
                    erc721WithERC2981Inst.address,
                    user2.address,
                    newRoyalty
                );

                const price = OneEth;
                const result1 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721WithERC2981Inst.address,
                    Zero,
                    price
                );
                expect(result1.royaltyAmount).to.be.equals(price.mul(newRoyalty).div(100_00));
                expect(result1.royaltyReceiver).to.be.equals(user2.address);

                await nftMarketplaceInst.disableAdminRoyalty(erc721WithERC2981Inst.address);

                const result2 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721WithERC2981Inst.address,
                    Zero,
                    price
                );
                expect(result2.royaltyAmount).to.be.equals(
                    price.mul(defaultERC2981Fee).div(100_00)
                );
                expect(result2.royaltyReceiver).to.be.equals(feeReceiverERC2981.address);
            });

            it("Order info for ownable", async () => {
                const {
                    nftMarketplaceInst,
                    erc721OwnableInst,
                    deployer,
                    user2,
                    defaultFeeForOwner,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

                const newRoyalty = 8_00;
                await nftMarketplaceInst.setRoyalty(
                    erc721OwnableInst.address,
                    user2.address,
                    newRoyalty
                );

                const price = OneEth;
                const result1 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address,
                    Zero,
                    price
                );
                expect(result1.royaltyAmount).to.be.equals(price.mul(newRoyalty).div(100_00));
                expect(result1.royaltyReceiver).to.be.equals(user2.address);

                await nftMarketplaceInst.disableAdminRoyalty(erc721OwnableInst.address);

                const result2 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address,
                    Zero,
                    price
                );
                expect(result2.royaltyAmount).to.be.equals(
                    price.mul(defaultFeeForOwner).div(100_00)
                );
                expect(result2.royaltyReceiver).to.be.equals(deployer.address);
            });
        });
    });
});
