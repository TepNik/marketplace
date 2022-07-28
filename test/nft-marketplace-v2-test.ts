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

const EthAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const OneHour = 3600;
const OneDay = 86400;

describe("NFT Marketplace V2 tests", function () {
    async function prepareEnvironment(): Promise<PrepareEnvironmentResult> {
        const [
            deployer,
            feeReceiver,
            feeReceiverERC2981,
            user1,
            user2,
            user3,
            royaltyManager,
            auctionManager,
        ] = await ethers.getSigners();
        tracer.nameTags[deployer.address] = "deployer";
        tracer.nameTags[feeReceiver.address] = "feeReceiver";
        tracer.nameTags[user1.address] = "user1";
        tracer.nameTags[user2.address] = "user2";
        tracer.nameTags[user3.address] = "user3";
        tracer.nameTags[royaltyManager.address] = "royaltyManager";
        tracer.nameTags[auctionManager.address] = "auctionManager";

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

        const auctionManagerRole = await nftMarketplaceInst.AUCTION_MANAGER();
        const royaltyManagerRole = await nftMarketplaceInst.ROYALTY_MANAGER();

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
            royaltyManager,
            auctionManager,

            timestampNow,
            feePercentage,
            defaultFeeForOwner,
            defaultERC2981Fee,

            auctionManagerRole,
            royaltyManagerRole,
        };
    }

    async function prepareEnvironmentAndRoles(): Promise<PrepareEnvironmentResult> {
        const result = await prepareEnvironment();

        await result.nftMarketplaceInst.grantRole(
            result.auctionManagerRole,
            result.auctionManager.address
        );
        await result.nftMarketplaceInst.grantRole(
            result.royaltyManagerRole,
            result.royaltyManager.address
        );

        await result.nftMarketplaceInst.renounceRole(
            result.auctionManagerRole,
            result.deployer.address
        );
        await result.nftMarketplaceInst.renounceRole(
            result.royaltyManagerRole,
            result.deployer.address
        );

        result.timestampNow = await time.latest();

        return result;
    }

    it("Deploy test", async () => {
        const { nftMarketplaceInst, feeReceiver } = <PrepareEnvironmentResult>(
            await loadFixture(prepareEnvironmentAndRoles)
        );
        expect(await nftMarketplaceInst.feeReceiver()).equals(feeReceiver.address);
        expect(await nftMarketplaceInst.isPausedCreation()).false;
    });

    it("ERC165 check", async () => {
        const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
            await loadFixture(prepareEnvironmentAndRoles)
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
            >await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
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
                    auctionData.lastBidAmount,
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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: EthAddress,
                lastBidAmount: OneToken.mul(10),
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst
                .connect(user2)
                .bidNative(auctionId, { value: auctionData.lastBidAmount });

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

            // second bid
            const endPrice = auctionData.lastBidAmount.mul(2);
            await nftMarketplaceInst.connect(user3).bidNative(auctionId, {
                value: endPrice,
            });

            // check that previous bid was return
            const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenTransferWithoutResultInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenTransferWithoutResultInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenTransferWithoutResultInst
                .connect(user2)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721WithERC2981Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721WithERC2981Inst
                .connect(user1)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc721WithERC2981Inst.connect(user1).mint(auctionData.tokenInfo.id);
            await erc721WithERC2981Inst
                .connect(user1)
                .setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: EthAddress,
                lastBidAmount: OneToken.mul(10),
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst
                .connect(user2)
                .bidNative(auctionId, { value: auctionData.lastBidAmount });

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

            // second bid
            const endPrice = auctionData.lastBidAmount.mul(2);
            await nftMarketplaceInst.connect(user3).bidNative(auctionId, {
                value: endPrice,
            });

            // check that previous bid was return
            const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenInst.balanceOf(user2.address);

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenInst.balanceOf(user2.address);
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenTransferWithoutResultInst.address,
                lastBidAmount: OneToken.mul(10),
                lastBidder: AddressZero,
            };

            // mint NFT
            await erc1155Inst
                .connect(user1)
                .mint(auctionData.tokenInfo.id, auctionData.tokenInfo.amount);
            await erc1155Inst.connect(user1).setApprovalForAll(nftMarketplaceInst.address, true);

            // mint ERC20 to user2
            await tokenTransferWithoutResultInst.connect(user2).mint(auctionData.lastBidAmount);
            await tokenTransferWithoutResultInst
                .connect(user2)
                .approve(nftMarketplaceInst.address, MaxUint256);

            // mint ERC20 to user3
            const endPrice = auctionData.lastBidAmount.mul(2);
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
                    auctionData.lastBidAmount,
                    auctionData.bidToken
                );

            await time.increaseTo(auctionData.startTime);

            // first bid
            await nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount);

            const auctionDataFromContractBid1 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidder = user2.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid1);

            const user2EthBalanceBefore = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );

            // second bid
            await nftMarketplaceInst.connect(user3).bid(auctionId, endPrice);

            // check that previous bid was return
            const user2EthBalanceAfter = await tokenTransferWithoutResultInst.balanceOf(
                user2.address
            );
            expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).equals(
                auctionData.lastBidAmount
            );

            const auctionDataFromContractBid2 = await nftMarketplaceInst.auctionData(auctionId);
            auctionData.lastBidAmount = endPrice;
            auctionData.lastBidder = user3.address;
            compareAuctionDataWithRaw(auctionData, auctionDataFromContractBid2);

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
            >await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
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
                    auctionData.lastBidAmount,
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
            >await loadFixture(prepareEnvironmentAndRoles);

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
                bidToken: tokenInst.address,
                lastBidAmount: OneToken.mul(10),
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
                    auctionData.lastBidAmount,
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
                    const { nftMarketplaceInst, auctionManager } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironmentAndRoles)
                    );

                    await nftMarketplaceInst.connect(auctionManager).togglePause();

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
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                            EthAddress
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
                            EthAddress
                        )
                    ).to.be.revertedWith("NftMarketplaceV2: Wrong start/end time");
                });

                it("Should revert in case of a bad bid token info", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, auctionManager } =
                        <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: EthAddress,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
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
                                auctionData.lastBidAmount,
                                auctionData.bidToken
                            )
                    ).to.be.revertedWith("NftMarketplaceV2: Existing auction");

                    await nftMarketplaceInst
                        .connect(auctionManager)
                        .deleteAuction(auctionId, true, false, true, false);

                    await expect(
                        nftMarketplaceInst
                            .connect(user1)
                            .createAuction(
                                tokenInfoToTokenInfoRaw(auctionData.tokenInfo),
                                auctionData.startTime,
                                auctionData.endTime,
                                auctionData.lastBidAmount,
                                auctionData.bidToken
                            )
                    ).to.be.revertedWith("NftMarketplaceV2: Auction is completed");
                });
            });

            describe("{bid} function", () => {
                it("Should revert in case of a bid to not active order", async () => {
                    const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironmentAndRoles)
                    );

                    await expect(nftMarketplaceInst.bid(Bytes32Zero, "0")).to.be.revertedWith(
                        "NftMarketplaceV2: No such open auction"
                    );
                });

                it("Should revert in case of a bad bid time", async () => {
                    const {
                        nftMarketplaceInst,
                        erc721Inst,
                        tokenInst,
                        timestampNow,
                        user1,
                        user2,
                    } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: tokenInst.address,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
                            auctionData.bidToken
                        );

                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount)
                    ).to.be.revertedWith("NftMarketplaceV2: Auction is not started");

                    await time.increaseTo(auctionData.endTime);

                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount)
                    ).to.be.revertedWith("NftMarketplaceV2: Auction has ended");
                });

                it("Should revert in case of a bad amount", async () => {
                    const {
                        nftMarketplaceInst,
                        erc721Inst,
                        tokenInst,
                        timestampNow,
                        user1,
                        user2,
                    } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: tokenInst.address,
                        lastBidAmount: OneToken.mul(10),
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
                        bidToken: EthAddress,
                        lastBidAmount: Zero,
                        lastBidder: AddressZero,
                    };

                    await erc721Inst.connect(user1).mint(auctionData1.tokenInfo.id);
                    await erc721Inst.connect(user1).mint(auctionData2.tokenInfo.id);
                    await erc721Inst
                        .connect(user1)
                        .setApprovalForAll(nftMarketplaceInst.address, true);

                    await tokenInst.connect(user2).mint(auctionData1.lastBidAmount);
                    await tokenInst.connect(user2).approve(nftMarketplaceInst.address, MaxUint256);

                    const auctionId1 = getAuctionId(auctionData1);
                    const auctionId2 = getAuctionId(auctionData2);
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData1.tokenInfo),
                            auctionData1.startTime,
                            auctionData1.endTime,
                            auctionData1.lastBidAmount,
                            auctionData1.bidToken
                        );
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData2.tokenInfo),
                            auctionData2.startTime,
                            auctionData2.endTime,
                            auctionData2.lastBidAmount,
                            auctionData2.bidToken
                        );

                    await time.increaseTo(auctionData1.startTime);

                    // test auction 1
                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId1, auctionData1.lastBidAmount.sub(1))
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    await nftMarketplaceInst
                        .connect(user2)
                        .bid(auctionId1, auctionData1.lastBidAmount);

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId1, auctionData1.lastBidAmount)
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    // test auction 2 zero amount
                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId2, "0")
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");
                });

                it("Should revert in case of a wrong auction (bid to auction with ETH)", async () => {
                    const {
                        nftMarketplaceInst,
                        erc721Inst,
                        tokenInst,
                        timestampNow,
                        user1,
                        user2,
                    } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: EthAddress,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
                            auctionData.bidToken
                        );

                    await time.increaseTo(auctionData.startTime);

                    await expect(
                        nftMarketplaceInst.connect(user2).bid(auctionId, auctionData.lastBidAmount)
                    ).to.be.revertedWith("NftMarketplaceV2: Token is not a contract");
                });
            });

            describe("{bidNative} function", () => {
                it("Should revert in case of a bid to not active order", async () => {
                    const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironmentAndRoles)
                    );

                    await expect(nftMarketplaceInst.bidNative(Bytes32Zero)).to.be.revertedWith(
                        "NftMarketplaceV2: No such open auction"
                    );
                });

                it("Should revert in case of a bad bid time", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: EthAddress,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
                            auctionData.bidToken
                        );

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bidNative(auctionId, { value: auctionData.lastBidAmount })
                    ).to.be.revertedWith("NftMarketplaceV2: Auction is not started");

                    await time.increaseTo(auctionData.endTime);

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bidNative(auctionId, { value: auctionData.lastBidAmount })
                    ).to.be.revertedWith("NftMarketplaceV2: Auction has ended");
                });

                it("Should revert in case of a bad amount", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: EthAddress,
                        lastBidAmount: OneToken.mul(10),
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
                        bidToken: EthAddress,
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
                            auctionData1.lastBidAmount,
                            auctionData1.bidToken
                        );
                    await nftMarketplaceInst
                        .connect(user1)
                        .createAuction(
                            tokenInfoToTokenInfoRaw(auctionData2.tokenInfo),
                            auctionData2.startTime,
                            auctionData2.endTime,
                            auctionData2.lastBidAmount,
                            auctionData2.bidToken
                        );

                    await time.increaseTo(auctionData1.startTime);

                    // test auction 1
                    await expect(
                        nftMarketplaceInst.connect(user2).bidNative(auctionId1, {
                            value: auctionData1.lastBidAmount.sub(1),
                        })
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    await nftMarketplaceInst
                        .connect(user2)
                        .bidNative(auctionId1, { value: auctionData1.lastBidAmount });

                    await expect(
                        nftMarketplaceInst.connect(user2).bidNative(auctionId1, {
                            value: auctionData1.lastBidAmount,
                        })
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");

                    // test auction 2 zero amount
                    await expect(
                        nftMarketplaceInst.connect(user2).bidNative(auctionId2)
                    ).to.be.revertedWith("NftMarketplaceV2: Too low amount");
                });

                it("Should revert in case of a wrong auction (bid to auction with ERC20)", async () => {
                    const {
                        nftMarketplaceInst,
                        erc721Inst,
                        tokenInst,
                        timestampNow,
                        user1,
                        user2,
                    } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: tokenInst.address,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
                            auctionData.bidToken
                        );

                    await time.increaseTo(auctionData.startTime);

                    await expect(
                        nftMarketplaceInst
                            .connect(user2)
                            .bidNative(auctionId, { value: auctionData.lastBidAmount })
                    ).to.be.revertedWith("NftMarketplaceV2: Use {bid} function");
                });
            });

            describe("{endAuction} function", async () => {
                it("Should revert in case of a not active order", async () => {
                    const { nftMarketplaceInst } = <PrepareEnvironmentResult>(
                        await loadFixture(prepareEnvironmentAndRoles)
                    );

                    await expect(nftMarketplaceInst.endAuction(Bytes32Zero)).to.be.revertedWith(
                        "NftMarketplaceV2: No such open auction"
                    );
                });

                it("Should revert in case of a bad time", async () => {
                    const { nftMarketplaceInst, erc721Inst, timestampNow, user1, user2 } = <
                        PrepareEnvironmentResult
                    >await loadFixture(prepareEnvironmentAndRoles);

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
                        bidToken: EthAddress,
                        lastBidAmount: OneToken.mul(10),
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
                            auctionData.lastBidAmount,
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
            const {
                nftMarketplaceInst,
                deployer,
                royaltyManager,
                royaltyManagerRole,
                auctionManager,
                auctionManagerRole,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironment);

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, deployer.address)).to.be.true;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, deployer.address)).to.be
                .true;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, deployer.address)).to.be
                .true;

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, royaltyManager.address)).to.be
                .false;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, royaltyManager.address)).to
                .be.false;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, royaltyManager.address)).to
                .be.false;

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, auctionManager.address)).to.be
                .false;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, auctionManager.address)).to
                .be.false;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, auctionManager.address)).to
                .be.false;

            expect(await nftMarketplaceInst.getRoleMemberCount(Bytes32Zero)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(Bytes32Zero, 0)).to.be.equals(
                deployer.address
            );

            expect(await nftMarketplaceInst.getRoleMemberCount(royaltyManagerRole)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(royaltyManagerRole, 0)).to.be.equals(
                deployer.address
            );

            expect(await nftMarketplaceInst.getRoleMemberCount(auctionManagerRole)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(auctionManagerRole, 0)).to.be.equals(
                deployer.address
            );
        });

        it("Check initial roles after setting roles", async () => {
            const {
                nftMarketplaceInst,
                deployer,
                royaltyManager,
                royaltyManagerRole,
                auctionManager,
                auctionManagerRole,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, deployer.address)).to.be.true;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, deployer.address)).to.be
                .false;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, deployer.address)).to.be
                .false;

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, royaltyManager.address)).to.be
                .false;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, royaltyManager.address)).to
                .be.true;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, royaltyManager.address)).to
                .be.false;

            expect(await nftMarketplaceInst.hasRole(Bytes32Zero, auctionManager.address)).to.be
                .false;
            expect(await nftMarketplaceInst.hasRole(royaltyManagerRole, auctionManager.address)).to
                .be.false;
            expect(await nftMarketplaceInst.hasRole(auctionManagerRole, auctionManager.address)).to
                .be.true;

            expect(await nftMarketplaceInst.getRoleMemberCount(Bytes32Zero)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(Bytes32Zero, 0)).to.be.equals(
                deployer.address
            );

            expect(await nftMarketplaceInst.getRoleMemberCount(royaltyManagerRole)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(royaltyManagerRole, 0)).to.be.equals(
                royaltyManager.address
            );

            expect(await nftMarketplaceInst.getRoleMemberCount(auctionManagerRole)).to.be.equals(1);
            expect(await nftMarketplaceInst.getRoleMember(auctionManagerRole, 0)).to.be.equals(
                auctionManager.address
            );
        });

        it("{setFeeInfo} function", async () => {
            const {
                nftMarketplaceInst,
                feePercentage,
                user1,
                auctionManagerRole,
                auctionManager,
                deployer,
                royaltyManager,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

            await expect(
                nftMarketplaceInst.connect(auctionManager).setFeeInfo(10_01, AddressZero)
            ).to.be.revertedWith("NftMarketplaceV2: Too big percentage");
            await expect(
                nftMarketplaceInst.connect(auctionManager).setFeeInfo(10_00, AddressZero)
            ).to.be.revertedWith("NftMarketplaceV2: Zero address");

            await expect(
                nftMarketplaceInst.connect(user1).setFeeInfo(10_00, AddressZero)
            ).to.be.revertedWith(
                "AccessControl: account " +
                    user1.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );
            await expect(
                nftMarketplaceInst.connect(deployer).setFeeInfo(10_00, AddressZero)
            ).to.be.revertedWith(
                "AccessControl: account " +
                    deployer.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );
            await expect(
                nftMarketplaceInst.connect(royaltyManager).setFeeInfo(10_00, AddressZero)
            ).to.be.revertedWith(
                "AccessControl: account " +
                    royaltyManager.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );

            const newValueFeePercentage = 10_00;
            const newValueFeeReceiver = user1.address;
            await nftMarketplaceInst
                .connect(auctionManager)
                .setFeeInfo(newValueFeePercentage, newValueFeeReceiver);
            expect(await nftMarketplaceInst.feePercentage()).to.be.equals(newValueFeePercentage);
            expect(await nftMarketplaceInst.feeReceiver()).to.be.equals(newValueFeeReceiver);
        });

        it("{togglePause} function", async () => {
            const {
                nftMarketplaceInst,
                deployer,
                user1,
                auctionManagerRole,
                auctionManager,
                royaltyManager,
            } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

            expect(await nftMarketplaceInst.isPausedCreation()).to.be.false;
            await expect(nftMarketplaceInst.connect(user1).togglePause()).to.be.revertedWith(
                "AccessControl: account " +
                    user1.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );
            await expect(nftMarketplaceInst.connect(deployer).togglePause()).to.be.revertedWith(
                "AccessControl: account " +
                    deployer.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );
            await expect(
                nftMarketplaceInst.connect(royaltyManager).togglePause()
            ).to.be.revertedWith(
                "AccessControl: account " +
                    royaltyManager.address.toLowerCase() +
                    " is missing role " +
                    auctionManagerRole
            );

            await nftMarketplaceInst.connect(auctionManager).togglePause();
            expect(await nftMarketplaceInst.isPausedCreation()).to.be.true;
        });

        describe("{deleteAuction} function", () => {
            it("Reverts", async () => {
                const {
                    nftMarketplaceInst,
                    deployer,
                    auctionManager,
                    royaltyManager,
                    user1,
                    auctionManagerRole,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                await expect(
                    nftMarketplaceInst
                        .connect(user1)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        auctionManagerRole
                );
                await expect(
                    nftMarketplaceInst
                        .connect(deployer)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        deployer.address.toLowerCase() +
                        " is missing role " +
                        auctionManagerRole
                );
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        royaltyManager.address.toLowerCase() +
                        " is missing role " +
                        auctionManagerRole
                );

                await expect(
                    nftMarketplaceInst
                        .connect(auctionManager)
                        .deleteAuction(Bytes32Zero, true, true, true, true)
                ).to.be.revertedWith("NftMarketplaceV2: No such open auction");
            });

            it("Auction without bids", async () => {
                const { nftMarketplaceInst, erc721Inst, timestampNow, user1, auctionManager } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironmentAndRoles);

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
                    bidToken: EthAddress,
                    lastBidAmount: OneToken.mul(10),
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
                        auctionData.lastBidAmount,
                        auctionData.bidToken
                    );

                await nftMarketplaceInst
                    .connect(auctionManager)
                    .deleteAuction(auctionId, true, false, true, false);

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
                const {
                    nftMarketplaceInst,
                    erc721Inst,
                    timestampNow,
                    user1,
                    user2,
                    auctionManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                    bidToken: EthAddress,
                    lastBidAmount: OneToken.mul(10),
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
                        auctionData.lastBidAmount,
                        auctionData.bidToken
                    );

                await time.increaseTo(auctionData.startTime);

                await nftMarketplaceInst
                    .connect(user2)
                    .bidNative(auctionId, { value: auctionData.lastBidAmount });

                const user2EthBalanceBefore = await ethers.provider.getBalance(user2.address);

                await nftMarketplaceInst
                    .connect(auctionManager)
                    .deleteAuction(auctionId, true, false, true, false);

                const user2EthBalanceAfter = await ethers.provider.getBalance(user2.address);
                expect(user2EthBalanceAfter.sub(user2EthBalanceBefore)).to.be.equals(
                    auctionData.lastBidAmount
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
                                auctionManager,
                            } = <PrepareEnvironmentResult>(
                                await loadFixture(prepareEnvironmentAndRoles)
                            );

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
                                bidToken: tokenInst.address,
                                lastBidAmount: OneToken.mul(10),
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                            await erc721Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                    auctionData.lastBidAmount,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.lastBidAmount);

                            await erc721Inst.revertTransfers();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId)
                            ).to.be.revertedWith("ERC721 transfer revert");

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await nftMarketplaceInst
                                .connect(auctionManager)
                                .deleteAuction(auctionId, false, false, true, false);

                            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                                nftMarketplaceInst.address
                            );

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.lastBidAmount);
                        });

                        it("Transfer gas ddos", async () => {
                            const {
                                nftMarketplaceInst,
                                erc721Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                                auctionManager,
                            } = <PrepareEnvironmentResult>(
                                await loadFixture(prepareEnvironmentAndRoles)
                            );

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
                                bidToken: tokenInst.address,
                                lastBidAmount: OneToken.mul(10),
                                lastBidder: AddressZero,
                            };

                            // mint NFT
                            await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                            await erc721Inst
                                .connect(user1)
                                .setApprovalForAll(nftMarketplaceInst.address, true);

                            // mint ERC20 to user2
                            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                    auctionData.lastBidAmount,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.lastBidAmount);

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
                                nftMarketplaceInst
                                    .connect(auctionManager)
                                    .deleteAuction(auctionId, true, false, true, false, {
                                        gasLimit: gasLimit,
                                    })
                            ).to.be.reverted;

                            await nftMarketplaceInst
                                .connect(auctionManager)
                                .deleteAuction(auctionId, false, true, true, false);

                            expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                                nftMarketplaceInst.address
                            );

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.lastBidAmount);
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
                                auctionManager,
                            } = <PrepareEnvironmentResult>(
                                await loadFixture(prepareEnvironmentAndRoles)
                            );

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
                                bidToken: tokenInst.address,
                                lastBidAmount: OneToken.mul(10),
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
                            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                    auctionData.lastBidAmount,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.lastBidAmount);

                            await erc1155Inst.revertTransfers();

                            await time.increaseTo(auctionData.endTime);
                            await expect(
                                nftMarketplaceInst.endAuction(auctionId)
                            ).to.be.revertedWith("ERC1155 transfer revert");

                            const user2TokenBalanceBefore = await tokenInst.balanceOf(
                                user2.address
                            );

                            await nftMarketplaceInst
                                .connect(auctionManager)
                                .deleteAuction(auctionId, false, false, true, false);

                            expect(
                                await erc1155Inst.balanceOf(
                                    nftMarketplaceInst.address,
                                    auctionData.tokenInfo.id
                                )
                            ).to.be.equals(auctionData.tokenInfo.amount);

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.lastBidAmount);
                        });

                        it("Transfer gas ddos", async () => {
                            const {
                                nftMarketplaceInst,
                                erc1155Inst,
                                timestampNow,
                                user1,
                                user2,
                                tokenInst,
                                auctionManager,
                            } = <PrepareEnvironmentResult>(
                                await loadFixture(prepareEnvironmentAndRoles)
                            );

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
                                bidToken: tokenInst.address,
                                lastBidAmount: OneToken.mul(10),
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
                            await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                    auctionData.lastBidAmount,
                                    auctionData.bidToken
                                );

                            await time.increaseTo(auctionData.startTime);

                            // bid
                            await nftMarketplaceInst
                                .connect(user2)
                                .bid(auctionId, auctionData.lastBidAmount);

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
                                nftMarketplaceInst
                                    .connect(auctionManager)
                                    .deleteAuction(auctionId, true, false, true, false, {
                                        gasLimit: gasLimit,
                                    })
                            ).to.be.reverted;

                            await nftMarketplaceInst
                                .connect(auctionManager)
                                .deleteAuction(auctionId, false, true, true, false);

                            expect(
                                await erc1155Inst.balanceOf(
                                    nftMarketplaceInst.address,
                                    auctionData.tokenInfo.id
                                )
                            ).to.be.equals(auctionData.tokenInfo.amount);

                            const user2TokenBalanceAfter = await tokenInst.balanceOf(user2.address);
                            expect(
                                user2TokenBalanceAfter.sub(user2TokenBalanceBefore)
                            ).to.be.equals(auctionData.lastBidAmount);
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
                            auctionManager,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                            bidToken: tokenInst.address,
                            lastBidAmount: OneToken.mul(10),
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                auctionData.lastBidAmount,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.lastBidAmount);

                        await tokenInst.returnTransferFalse();

                        await time.increaseTo(auctionData.endTime);
                        await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                            "NftMarketplaceV2: ERC20 transfer result false"
                        );

                        await nftMarketplaceInst
                            .connect(auctionManager)
                            .deleteAuction(auctionId, true, false, false, false);

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.lastBidAmount
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
                            auctionManager,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                            bidToken: tokenInst.address,
                            lastBidAmount: OneToken.mul(10),
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                auctionData.lastBidAmount,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.lastBidAmount);

                        await tokenInst.revertTransfers();

                        await time.increaseTo(auctionData.endTime);
                        await expect(nftMarketplaceInst.endAuction(auctionId)).to.be.revertedWith(
                            "ERC20 transfer revert"
                        );

                        await nftMarketplaceInst
                            .connect(auctionManager)
                            .deleteAuction(auctionId, true, false, false, false);

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.lastBidAmount
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
                            auctionManager,
                        } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                            bidToken: tokenInst.address,
                            lastBidAmount: OneToken.mul(10),
                            lastBidder: AddressZero,
                        };

                        // mint NFT
                        await erc721Inst.connect(user1).mint(auctionData.tokenInfo.id);
                        await erc721Inst
                            .connect(user1)
                            .setApprovalForAll(nftMarketplaceInst.address, true);

                        // mint ERC20 to user2
                        await tokenInst.connect(user2).mint(auctionData.lastBidAmount);
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
                                auctionData.lastBidAmount,
                                auctionData.bidToken
                            );

                        await time.increaseTo(auctionData.startTime);

                        // bid
                        await nftMarketplaceInst
                            .connect(user2)
                            .bid(auctionId, auctionData.lastBidAmount);

                        await tokenInst.unlimitedGasSpend();

                        await time.increaseTo(auctionData.endTime);
                        await expect(
                            nftMarketplaceInst.endAuction(auctionId, {
                                gasLimit: gasLimit,
                            })
                        ).to.be.reverted;

                        await nftMarketplaceInst
                            .connect(auctionManager)
                            .deleteAuction(auctionId, true, false, false, true, {
                                gasLimit: gasLimit,
                            });

                        expect(await erc721Inst.ownerOf(auctionData.tokenInfo.id)).to.be.equals(
                            user1.address
                        );
                        expect(await tokenInst.balanceOf(nftMarketplaceInst.address)).to.be.equals(
                            auctionData.lastBidAmount
                        );
                    });
                });
            });
        });
    });

    describe("Royalties", () => {
        describe("Admin functions", () => {
            it("{setRoyalty} function", async () => {
                const {
                    nftMarketplaceInst,
                    deployer,
                    user1,
                    user2,
                    erc721Inst,
                    erc1155Inst,
                    royaltyManagerRole,
                    royaltyManager,
                    auctionManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                await expect(
                    nftMarketplaceInst.connect(user1).setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        deployer.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst
                        .connect(auctionManager)
                        .setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        auctionManager.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );

                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setRoyalty(AddressZero, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Not a contract");
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setRoyalty(nftMarketplaceInst.address, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Wrong interface");
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setRoyalty(erc721Inst.address, AddressZero, Zero)
                ).to.be.revertedWith("RoyaltiesInfo: Percentage");
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setRoyalty(erc721Inst.address, AddressZero, 10_01)
                ).to.be.revertedWith("RoyaltiesInfo: Percentage");
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setRoyalty(erc721Inst.address, AddressZero, 10_00)
                ).to.be.revertedWith("RoyaltiesInfo: royaltyReceiver");

                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .setRoyalty(erc721Inst.address, user1.address, One);
                await nftMarketplaceInst
                    .connect(royaltyManager)
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
                const {
                    nftMarketplaceInst,
                    deployer,
                    user1,
                    defaultFeeForOwner,
                    royaltyManagerRole,
                    royaltyManager,
                    auctionManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                await expect(
                    nftMarketplaceInst.connect(user1).setDefaultFeeForOwner(Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).setDefaultFeeForOwner(Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        deployer.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst.connect(auctionManager).setDefaultFeeForOwner(Zero)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        auctionManager.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );

                await expect(
                    nftMarketplaceInst.connect(royaltyManager).setDefaultFeeForOwner(10_01)
                ).to.be.revertedWith("NftMarketplace: Too big percent");
                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .setDefaultFeeForOwner(defaultFeeForOwner)
                ).to.be.revertedWith("NftMarketplace: No change");

                const newValue = 10;
                await nftMarketplaceInst.connect(royaltyManager).setDefaultFeeForOwner(newValue);

                expect(await nftMarketplaceInst.defaultFeeForOwner()).to.be.equals(newValue);
            });

            it("{disableAdminRoyalty} function", async () => {
                const {
                    nftMarketplaceInst,
                    deployer,
                    user1,
                    erc721Inst,
                    royaltyManagerRole,
                    royaltyManager,
                    auctionManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                await expect(
                    nftMarketplaceInst.connect(user1).disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        user1.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst.connect(deployer).disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        deployer.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );
                await expect(
                    nftMarketplaceInst
                        .connect(auctionManager)
                        .disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith(
                    "AccessControl: account " +
                        auctionManager.address.toLowerCase() +
                        " is missing role " +
                        royaltyManagerRole
                );

                await expect(
                    nftMarketplaceInst
                        .connect(royaltyManager)
                        .disableAdminRoyalty(erc721Inst.address)
                ).to.be.revertedWith("RoyaltiesInfo: Disabled");

                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .setRoyalty(erc721Inst.address, user1.address, 10);
                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .disableAdminRoyalty(erc721Inst.address);

                const info = await nftMarketplaceInst.royaltiesInfo(erc721Inst.address);
                expect(info.isEnabled).to.be.false;
                expect(info.royaltyPercentage).to.be.equals(Zero);
                expect(info.royaltyReceiver).to.be.equals(AddressZero);
            });
        });

        describe("{getRoyaltyInfo} function", async () => {
            it("Without royalty info", async () => {
                const { nftMarketplaceInst, erc721Inst } = <PrepareEnvironmentResult>(
                    await loadFixture(prepareEnvironmentAndRoles)
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
                const { nftMarketplaceInst, erc721Inst, user1, royaltyManager } = <
                    PrepareEnvironmentResult
                >await loadFixture(prepareEnvironmentAndRoles);

                const royaltyPercentage = 100;
                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .setRoyalty(erc721Inst.address, user1.address, royaltyPercentage);

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
                >await loadFixture(prepareEnvironmentAndRoles);

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
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

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
                    royaltyManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                const newRoyalty = 8_00;
                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .setRoyalty(erc721WithERC2981Inst.address, user2.address, newRoyalty);

                const price = OneEth;
                const result1 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721WithERC2981Inst.address,
                    Zero,
                    price
                );
                expect(result1.royaltyAmount).to.be.equals(price.mul(newRoyalty).div(100_00));
                expect(result1.royaltyReceiver).to.be.equals(user2.address);

                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .disableAdminRoyalty(erc721WithERC2981Inst.address);

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
                    royaltyManager,
                } = <PrepareEnvironmentResult>await loadFixture(prepareEnvironmentAndRoles);

                const newRoyalty = 8_00;
                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .setRoyalty(erc721OwnableInst.address, user2.address, newRoyalty);

                const price = OneEth;
                const result1 = await nftMarketplaceInst.getRoyaltyInfo(
                    erc721OwnableInst.address,
                    Zero,
                    price
                );
                expect(result1.royaltyAmount).to.be.equals(price.mul(newRoyalty).div(100_00));
                expect(result1.royaltyReceiver).to.be.equals(user2.address);

                await nftMarketplaceInst
                    .connect(royaltyManager)
                    .disableAdminRoyalty(erc721OwnableInst.address);

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
