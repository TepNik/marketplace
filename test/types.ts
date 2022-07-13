import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export enum TokenType {
    ERC20 = "ERC20",
    ERC721 = "ERC721",
    ERC1155 = "ERC1155",
}

export interface TokenInfo {
    tokenType: TokenType;
    tokenAddress: string;
    id: BigNumber;
    amount: BigNumber;
}

export interface TokenInfoRaw {
    tokenType: number;
    tokenAddress: string;
    id: BigNumber;
    amount: BigNumber;
}

export interface AuctionData {
    tokenInfo: TokenInfo;
    seller: string;
    startTime: number;
    endTime: number;
    minPrice: BigNumber;
    bidToken: string;
    lastBidAmount: BigNumber;
    lastBidder: string;
}

export interface AuctionDataRaw {
    tokenInfo: TokenInfoRaw;
    seller: string;
    startTime: number;
    endTime: number;
    minPrice: BigNumber;
    bidToken: string;
    lastBidAmount: BigNumber;
    lastBidder: string;
}

export interface RoyaltyInfo {
    isEnabled: boolean;
    royaltyReceiver: string;
    royaltyPercentage: number;
}

interface GetRoyaltyInfoRaw {
    royaltyReceiver: string;
    royaltyAmount: BigNumber;
}

export interface ERC20Contract extends Contract {
    connect(user: SignerWithAddress): ERC20Contract;

    revertTransfers(): Promise<void>;
    unlimitedGasSpend(): Promise<void>;
    returnTransferFalse(): Promise<void>;

    totalSupply(): Promise<BigNumber>;
    balanceOf(account: string): Promise<BigNumber>;
    transfer(
        to: string,
        amount: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    allowance(owner: string, spender: string): Promise<BigNumber>;
    approve(
        spender: string,
        amount: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    transferFrom(
        from: string,
        to: string,
        amount: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
}

export interface ERC721Contract extends Contract {
    connect(user: SignerWithAddress): ERC721Contract;

    revertTransfers(): Promise<void>;
    unlimitedGasSpend(): Promise<void>;

    balanceOf(owner: string): Promise<BigNumber>;
    ownerOf(tokenId: string | BigNumber): Promise<string>;
    safeTransferFrom(
        from: string,
        to: string,
        tokenId: string | BigNumber,
        data: string,
        txParams?: TransactionParameters
    ): Promise<void>;
    safeTransferFrom(
        from: string,
        to: string,
        tokenId: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    transferFrom(
        from: string,
        to: string,
        tokenId: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    approve(
        to: string,
        tokenId: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    setApprovalForAll(
        operator: string,
        approved: boolean,
        txParams?: TransactionParameters
    ): Promise<void>;
    getApproved(tokenId: string | BigNumber): Promise<string>;
    isApprovedForAll(owner: string, operator: string): Promise<boolean>;

    mint(id: string | BigNumber, txParams?: TransactionParameters): Promise<void>;
    burn(id: string | BigNumber, txParams?: TransactionParameters): Promise<void>;
}

export interface ERC721WithERC2981Contract extends ERC721Contract {
    connect(user: SignerWithAddress): ERC721WithERC2981Contract;

    returnBadValue(): Promise<void>;
    setReceiver(newValue: string): Promise<void>;

    defaultFee(): Promise<number>;

    royaltyInfo(
        tokenId: string | BigNumber,
        salePrice: string | BigNumber
    ): Promise<GetRoyaltyInfoRaw>;
}

export interface ERC1155Contract extends Contract {
    connect(user: SignerWithAddress): ERC1155Contract;

    revertTransfers(): Promise<void>;
    unlimitedGasSpend(): Promise<void>;

    balanceOf(account: string, id: string | BigNumber): Promise<BigNumber>;
    balanceOfBatch(accounts: string[], ids: string[] | BigNumber[]): Promise<BigNumber[]>;
    setApprovalForAll(
        operator: string,
        approved: boolean,
        txParams?: TransactionParameters
    ): Promise<void>;
    isApprovedForAll(account: string, operator: string): Promise<boolean>;
    safeTransferFrom(
        from: string,
        to: string,
        id: string | BigNumber,
        amount: string | BigNumber,
        data: string,
        txParams?: TransactionParameters
    ): Promise<void>;
    safeBatchTransferFrom(
        from: string,
        to: string,
        ids: string[] | BigNumber[],
        amounts: string[] | BigNumber[],
        data: string,
        txParams?: TransactionParameters
    ): Promise<void>;

    mint(
        id: string | BigNumber,
        amount: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    burn(
        id: string | BigNumber,
        amount: string | BigNumber[],
        txParams?: TransactionParameters
    ): Promise<void>;
    burnBatch(
        ids: string[] | BigNumber[],
        amounts: string[] | BigNumber[],
        txParams?: TransactionParameters
    ): Promise<void>;
}

export interface RoyaltiesInfoContract {
    royaltiesInfo(user: string): Promise<RoyaltyInfo>;
    defaultFeeForOwner(): Promise<number>;
    setRoyalty(
        token: string,
        royaltyReceiver: string,
        royaltyPercentage: number | string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    setDefaultFeeForOwner(
        newValue: number | string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    disableAdminRoyalty(token: string, txParams?: TransactionParameters): Promise<void>;

    getRoyaltyInfo(
        token: string,
        tokenId: string | BigNumber,
        salePrice: string | BigNumber
    ): Promise<GetRoyaltyInfoRaw>;
}

export interface AccessControlContract {
    hasRole(role: string, account: string): Promise<boolean>;
    getRoleAdmin(role: string): Promise<boolean>;

    getRoleMemberCount(role: string): Promise<BigNumber>;
    getRoleMember(role: string, index: number | string | BigNumber): Promise<string>;

    grantRole(role: string, account: string): Promise<void>;
    revokeRole(role: string, account: string): Promise<void>;
    renounceRole(role: string, account: string): Promise<void>;
}

export interface ERC165Contract {
    supportsInterface(interfaceId: string): Promise<boolean>;
}

export interface NftMarketplaceV2Contract
    extends RoyaltiesInfoContract,
        AccessControlContract,
        ERC165Contract,
        Contract {
    connect(user: SignerWithAddress): NftMarketplaceV2Contract;

    isPausedCreation(): Promise<boolean>;
    auctionData(auctionId: string): Promise<AuctionDataRaw>;
    isAuctionCompleted(auctionId: string): Promise<boolean>;
    feePercentage(): Promise<BigNumber>;
    feeReceiver(): Promise<string>;

    createAuction(
        //tokenInfo: string[],
        tokenInfo: TokenInfoRaw,
        startTime: number,
        endTime: number,
        minPrice: string | BigNumber,
        bidToken: string,
        txParams?: TransactionParameters
    ): Promise<void>;
    bid(
        auctionId: string,
        amount: string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    endAuction(auctionId: string, txParams?: TransactionParameters): Promise<void>;

    deleteAuction(
        auctionId: string,
        requireSuccessSeller: boolean,
        setGasLimitForSellerTransfer: boolean,
        requireSuccessBuyer: boolean,
        setGasLimitForBuyerTransfer: boolean,
        txParams?: TransactionParameters
    ): Promise<void>;

    setFeePercentage(
        newValue: number | string | BigNumber,
        txParams?: TransactionParameters
    ): Promise<void>;
    setFeeReceiver(newValue: string, txParams?: TransactionParameters): Promise<void>;

    togglePause(txParams?: TransactionParameters): Promise<void>;

    activeAuctionsLength(): Promise<BigNumber>;
    activeAuctionsAt(index: number | string | BigNumber): Promise<string>;
    activeAuctionsContains(auctionId: string): Promise<boolean>;
}

export interface PrepareEnvironmentResult {
    tokenInst: ERC20Contract;
    tokenTransferWithoutResultInst: ERC20Contract;
    erc721Inst: ERC721Contract;
    erc721OwnableInst: ERC721Contract;
    erc721WithERC2981Inst: ERC721WithERC2981Contract;
    erc1155Inst: ERC1155Contract;
    erc1155OwnableInst: ERC1155Contract;

    nftMarketplaceInst: NftMarketplaceV2Contract;

    deployer: SignerWithAddress;
    feeReceiver: SignerWithAddress;
    feeReceiverERC2981: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    user3: SignerWithAddress;
    timestampNow: number;
    feePercentage: BigNumber;
    defaultFeeForOwner: number;
    defaultERC2981Fee: number;
}

export interface TransactionParameters {
    value?: string | BigNumber;
    gasPrice?: number | string | BigNumber;
    gasLimit?: number | string | BigNumber;
}
