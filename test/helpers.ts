import { AuctionData, AuctionDataRaw, TokenInfo, TokenInfoRaw, TokenType } from "./types";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export function compareAuctionDataWithRaw(
    auctionData: AuctionData,
    auctionDataRaw: AuctionDataRaw
) {
    expect(auctionDataRaw.tokenInfo.tokenType).equals(
        tokenTypeToNumber(auctionData.tokenInfo.tokenType)
    );
    expect(auctionDataRaw.tokenInfo.tokenAddress).equals(auctionData.tokenInfo.tokenAddress);
    expect(auctionDataRaw.tokenInfo.id).equals(auctionData.tokenInfo.id);
    expect(auctionDataRaw.tokenInfo.amount).equals(auctionData.tokenInfo.amount);

    expect(auctionDataRaw.seller).equals(auctionData.seller);
    expect(auctionDataRaw.startTime).equals(auctionData.startTime);
    expect(auctionDataRaw.endTime).equals(auctionData.endTime);
    expect(auctionDataRaw.bidToken).equals(auctionData.bidToken);
    expect(auctionDataRaw.lastBidAmount).equals(auctionData.lastBidAmount);
    expect(auctionDataRaw.lastBidder).equals(auctionData.lastBidder);
}

export function getAuctionId(auctionData: AuctionData): string {
    return getAuctionIdRaw(
        auctionData.tokenInfo,
        auctionData.seller,
        auctionData.startTime,
        auctionData.endTime,
        auctionData.bidToken
    );
}

export function getAuctionIdRaw(
    tokenInfo: TokenInfo,
    seller: string,
    startTime: number,
    endTime: number,
    bidToken: string
): string {
    const encodeData = ethers.utils.defaultAbiCoder.encode(
        ["(uint8,address,uint256,uint256)", "address", "uint128", "uint128", "address"],
        [
            [
                tokenTypeToNumber(tokenInfo.tokenType),
                tokenInfo.tokenAddress,
                tokenInfo.id.toString(),
                tokenInfo.amount.toString(),
            ],
            seller,
            startTime,
            endTime,
            bidToken,
        ]
    );
    return ethers.utils.keccak256(ethers.utils.arrayify(encodeData));
}

export function tokenTypeToNumber(tokenType: TokenType): number {
    if (tokenType == TokenType.ERC20) {
        return 0;
    } else if (tokenType == TokenType.ERC721) {
        return 1;
    } else {
        return 2;
    }
}

export function tokenInfoToTokenInfoRaw(tokenInfo: TokenInfo): TokenInfoRaw {
    return {
        tokenType: tokenTypeToNumber(tokenInfo.tokenType),
        tokenAddress: tokenInfo.tokenAddress,
        id: tokenInfo.id,
        amount: tokenInfo.amount,
    };
}
