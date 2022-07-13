// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.15;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder, ERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import {RoyaltiesInfo, AccessControlEnumerable} from "./RoyaltiesInfo.sol";

contract NftMarketplaceV2 is RoyaltiesInfo, ERC721Holder, ERC1155Holder, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    enum TokenType {
        ERC20,
        ERC721,
        ERC1155
    }

    struct TokenInfo {
        TokenType tokenType;
        address tokenAddress;
        uint256 id; // For ERC20 must be 0
        uint256 amount; // For ERC721 must be 0
    }

    struct AuctionData {
        TokenInfo tokenInfo;
        address seller;
        uint32 startTime;
        uint32 endTime;
        uint256 minPrice;
        address bidToken; // for native token use address(0)
        uint256 lastBidAmount;
        address lastBidder;
    }

    // public

    /// @notice True if the creation of new auctions is paused by an admin.
    bool public isPausedCreation;

    /// @notice Get information for an auction.
    mapping(bytes32 => AuctionData) public auctionData;
    /// @notice Check if some auction has already been completed or not.
    mapping(bytes32 => bool) public isAuctionCompleted;

    /// @notice Fee percentage of the marketplace (denominator 10000). Max value is 1000 (10%).
    uint256 public feePercentage = 2_50; // 2.5%
    /// @notice Address that will receive all marketplace fees.
    address public feeReceiver;

    // private

    EnumerableSet.Bytes32Set private _activeAuctions;

    uint256 private constant _MAX_GAS_FOR_NATIVE_TRANSFER = 200_000;
    uint256 private constant _MAX_GAS_FOR_TOKEN_TRANSFER = 1_000_000;

    // events

    /// @notice The event is emitted when fees of the marketplace were transferred.
    /// @param feeReceiver Address that received fees
    /// @param token Address of a token that was transferred
    /// @param amount Fee amount
    event FeeTransferred(address indexed feeReceiver, address indexed token, uint256 amount);
    /// @notice The event is emitted when royalties were transferred.
    /// @param royaltyReceiver Address that received royalties
    /// @param token Address of a token that was transferred
    /// @param amount Royalty amount
    event RoyaltyTransferred(
        address indexed royaltyReceiver,
        address indexed token,
        uint256 amount
    );

    /// @notice The event is emitted when an admin (`manager`) has set new fee percentages (`newValue`) for the marketplace.
    /// @param manager Address of the admin that has changed fee percentages for the marketplace
    /// @param oldValue Previous value of fee percentages for the marketplace
    /// @param newValue New value of fee percentages for the marketplace
    event FeePercentageChange(address indexed manager, uint256 oldValue, uint256 newValue);
    /// @notice The event is emitted when an admin (`manager`) has set a new fee receiver (`newValue`) for the marketplace.
    /// @param manager Address of an admin that has changed fee receiver for the marketplace
    /// @param oldValue Previous fee receiver of the marketplace
    /// @param newValue New fee receiver of the marketplace
    event FeeReceiverChange(
        address indexed manager,
        address indexed oldValue,
        address indexed newValue
    );

    /// @notice The event is emitted when `user` creates a new auction (`auctionId`) to sell his nft.
    /// @param user User that creates auction
    /// @param tokenInfo Information about NFT that user puts on sale
    /// @param startTime Time when the auction will start
    /// @param endTime Time when the auction will end
    /// @param minPrice Minimum price in token `bidToken`
    /// @param bidToken Address of a token that will be accepted for a bid (0x0 address is used for the native token)
    /// @param auctionId Unique identifier for this new auction
    event AuctoinCreated(
        address indexed user,
        TokenInfo tokenInfo,
        uint256 startTime,
        uint256 endTime,
        uint256 minPrice,
        address indexed bidToken,
        bytes32 auctionId
    );
    /// @notice The event is emitted when `user` makes a bid on the auction (`auctionId`).
    /// @param auctionId Auction identifier for which `user` makes a bid
    /// @param user User that makes a bid
    /// @param bidToken Address of the token that bids `user` (0x0 address is used for the native token)
    /// @param bidAmount Amount of the bid
    event BidMade(
        bytes32 auctionId,
        address indexed user,
        address indexed bidToken,
        uint256 bidAmount
    );
    /// @notice The event is emitted when to the auction (`auctionId`) comes a new bid with a bigger amount of the bid.
    /// @param auctionId Auction identifier in which `user` made the bid
    /// @param user User that gets his bid back
    /// @param bidToken Address of the token that will be refunded to the `user` (0x0 address is used for the native token)
    /// @param bidAmount Amount of refund
    event BidRefund(
        bytes32 auctionId,
        address indexed user,
        address indexed bidToken,
        uint256 bidAmount
    );
    /// @notice The event is emitted when `seller` cancels his auction (`auctionId`).
    /// It may happen when to this auction there wasn't any bid made and
    /// for this auction function {endAuction} was called.
    /// @param auctionId Auction identifier which was canceled
    /// @param seller User that created an auction
    /// @param tokenInfo Token info for NFT that was selling in this auction
    event AuctionCalceled(bytes32 auctionId, address indexed seller, TokenInfo tokenInfo);
    /// @notice The event is emitted when the auction (`auctionId`) was successfully closed.
    /// @param auctionId Auction identifier which was successfully closed
    /// @param seller User that sells NFT
    /// @param buyer User that buys NFT
    /// @param tokenInfoSell Token info for NFT
    /// @param tokenInfoBid Token info for bid token (0x0 address is used for the native token)
    event AuctionEnded(
        bytes32 auctionId,
        address indexed seller,
        address indexed buyer,
        TokenInfo tokenInfoSell,
        TokenInfo tokenInfoBid
    );

    /// @notice The event is emitted when an admin (`manager`) toggles the pause of the marketplace.
    /// @param manager Address of an admin that made this swap
    /// @param oldValue Previous value of the pause
    /// @param newValue New value of the pause
    event PauseToggled(address indexed manager, bool oldValue, bool newValue);
    /// @notice The event is emitted when an admin (`manager`) deletes an auction (`auctionId`).
    /// @param manager Address of an admin that deleted the auction
    /// @param auctionId Auction identifier which was deleted
    event AucitonDeleted(address indexed manager, bytes32 auctionId);
    /// @notice The event is emitted when token transfer failed.
    /// @param to Receiver address
    /// @param tokenAddress Token address
    /// @param tokenType Type of the token (ERC20 = 0, ERC721 = 1, ERC1155 = 2)
    /// @param id Token id that were tried to transfer. For ERC20 it will be zero
    /// @param amount Amount of the token. For ERC721 it will be zero
    /// @param errorString Error message of the transfer. For ERC20 it can be "NftMarketplaceV2: ERC20 transfer result false" means that transfer succedded but the result is false
    event BadTokenTransfer(
        address indexed to,
        address indexed tokenAddress,
        TokenType tokenType,
        uint256 id,
        uint256 amount,
        string errorString
    );
    /// @notice The event is emitted when transfer of the native token failed.
    /// @param to Receiver address
    /// @param amount Amount of the token. For ERC721 it will be zero
    /// @param errorString Error message of the transfer
    event BadNativeTokenTransfer(address indexed to, uint256 amount, string errorString);

    /// @notice The constructor of the marketplace.
    /// @param _feeReceiver Address of a fee receiver of the marketplace
    constructor(address _feeReceiver) {
        require(_feeReceiver != address(0), "NftMarketplaceV2: Zero address");
        feeReceiver = _feeReceiver;

        emit FeePercentageChange(msg.sender, 0, feePercentage);
        emit FeeReceiverChange(msg.sender, address(0), _feeReceiver);
    }

    // external

    /// @notice Create a new auction.
    /// @param tokenInfo Token info for the NFT that will be placed on sale
    /// @param startTime Time when this auction will start
    /// @param endTime Time when this auction will end
    /// @param minPrice Minimum price for this NFT
    /// @param bidToken Address of the token that will be accepted for bids (0x0 address is used for the native token)
    function createAuction(
        TokenInfo calldata tokenInfo,
        uint32 startTime,
        uint32 endTime,
        uint256 minPrice,
        address bidToken
    ) external nonReentrant returns (bytes32 auctionId) {
        require(!isPausedCreation, "NftMarketplaceV2: Creation paused");

        require(tokenInfo.tokenType != TokenType.ERC20, "NftMarketplaceV2: Only NFT");
        _verifyToken(tokenInfo);

        if (bidToken != address(0)) {
            require(bidToken.isContract(), "NftMarketplaceV2: bidToken is not a contract");
            require(IERC20Metadata(bidToken).decimals() > 0, "NftMarketplaceV2: Not ERC20");
        }
        require(msg.sender == tx.origin, "NftMarketplaceV2: Not allowed contracts");
        require(
            startTime < endTime && endTime > block.timestamp,
            "NftMarketplaceV2: Wrong start/end time"
        );

        AuctionData memory _auctionData = AuctionData({
            tokenInfo: tokenInfo,
            seller: msg.sender,
            startTime: startTime,
            endTime: endTime,
            minPrice: minPrice,
            bidToken: bidToken,
            lastBidAmount: 0,
            lastBidder: address(0)
        });
        auctionId = _getAuctionId(_auctionData);

        require(auctionData[auctionId].seller == address(0), "NftMarketplaceV2: Existing auction");
        require(isAuctionCompleted[auctionId] == false, "NftMarketplaceV2: Auction is completed");

        auctionData[auctionId] = _auctionData;
        _activeAuctions.add(auctionId);

        _tokenTransfer(tokenInfo, msg.sender, address(this), true, false);

        emit AuctoinCreated(
            msg.sender,
            tokenInfo,
            startTime,
            endTime,
            minPrice,
            bidToken,
            auctionId
        );
    }

    /// @notice Make a bid to the auction with id `auctionId`.
    /// If auction has (bidToken == 0x0) then `amount` should be added to the value of tx
    /// else the value of tx should be zero.
    /// @param auctionId Auction identifier to which the bid will be made
    /// @param amount Amount of the bid
    function bid(bytes32 auctionId, uint256 amount) external payable nonReentrant {
        require(msg.sender == tx.origin, "NftMarketplaceV2: Not allowed contracts");

        AuctionData storage _auctionData = auctionData[auctionId];
        require(_auctionData.seller != address(0), "NftMarketplaceV2: No such open auction");

        require(
            block.timestamp >= _auctionData.startTime,
            "NftMarketplaceV2: Auction is not started"
        );
        require(block.timestamp < _auctionData.endTime, "NftMarketplaceV2: Auction has ended");

        address bidToken = _auctionData.bidToken;
        uint256 lastBidAmount = _auctionData.lastBidAmount;

        require(
            amount > 0 &&
                (lastBidAmount > 0 ? amount > lastBidAmount : true) &&
                amount >= _auctionData.minPrice,
            "NftMarketplaceV2: Too low amount"
        );

        if (lastBidAmount > 0) {
            address lastBidder = _auctionData.lastBidder;
            _tokenTransfer(
                TokenInfo({
                    tokenType: TokenType.ERC20,
                    tokenAddress: bidToken,
                    id: 0,
                    amount: lastBidAmount
                }),
                address(this),
                lastBidder,
                true,
                false
            );

            emit BidRefund(auctionId, lastBidder, bidToken, lastBidAmount);
        }

        _tokenTransfer(
            TokenInfo({tokenType: TokenType.ERC20, tokenAddress: bidToken, id: 0, amount: amount}),
            msg.sender,
            address(this),
            true,
            false
        );

        _auctionData.lastBidder = msg.sender;
        _auctionData.lastBidAmount = amount;

        emit BidMade(auctionId, msg.sender, bidToken, amount);
    }

    /// @notice Function for ending the auction. Can be called only when endTime of an auction has passed.
    /// If there are no bids, NFT will be refunded to a seller of an auction.
    /// If there is a bid, an auction will be processed.
    /// @param auctionId Auction identifier that will be ended
    function endAuction(bytes32 auctionId) external nonReentrant {
        AuctionData storage _auctionData = auctionData[auctionId];

        address seller = _auctionData.seller;
        require(seller != address(0), "NftMarketplaceV2: No such open auction");

        require(block.timestamp >= _auctionData.endTime, "NftMarketplaceV2: Not ended yet");

        address lastBidder = _auctionData.lastBidder;
        if (lastBidder == address(0)) {
            TokenInfo memory tokenInfo = _auctionData.tokenInfo;
            _tokenTransfer(tokenInfo, address(this), seller, true, false);

            emit AuctionCalceled(auctionId, seller, tokenInfo);
        } else {
            TokenInfo memory tokenInfo = _auctionData.tokenInfo;

            uint256 price = _auctionData.lastBidAmount;

            (address royaltyReceiver, uint256 royaltyAmount) = getRoyaltyInfo(
                tokenInfo.tokenAddress,
                tokenInfo.id,
                price
            );

            address bidToken = _auctionData.bidToken;

            _tokenTransfer(tokenInfo, address(this), lastBidder, true, false);

            _tokenTransferWithFee(
                TokenInfo({
                    tokenType: TokenType.ERC20,
                    tokenAddress: bidToken,
                    id: 0,
                    amount: price
                }),
                address(this),
                seller,
                royaltyReceiver,
                royaltyAmount
            );

            emit AuctionEnded(
                auctionId,
                seller,
                lastBidder,
                tokenInfo,
                TokenInfo({
                    tokenType: TokenType.ERC20,
                    tokenAddress: bidToken,
                    id: 0,
                    amount: price
                })
            );
        }

        delete auctionData[auctionId];
        isAuctionCompleted[auctionId] = true;
        _activeAuctions.remove(auctionId);
    }

    // external admin

    /// @notice Admin function for setting a new value for fee percentages of the marketplace.
    /// @param newValue New value of the marketplace fee percentages
    function setFeePercentage(uint256 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue <= 10_00, "NftMarketplaceV2: Too big percentage"); // 10% max

        uint256 oldValue = feePercentage;
        require(oldValue != newValue, "NftMarketplaceV2: No change");
        feePercentage = newValue;

        emit FeePercentageChange(msg.sender, oldValue, newValue);
    }

    /// @notice Admin function for setting a new value for the marketplace's fee receiver.
    /// @param newValue New value of the marketplace's fee receiver
    function setFeeReceiver(address newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue != address(0), "NftMarketplaceV2: Zero address");

        address oldValue = feeReceiver;
        require(oldValue != newValue, "NftMarketplaceV2: No change");
        feeReceiver = newValue;

        emit FeeReceiverChange(msg.sender, oldValue, newValue);
    }

    /// @notice Admin function for deleting auction (`auctionId`) is case of
    /// wrong parameters and if NFT or a bid token reverts token transfer (or gas ddos).
    /// @param auctionId Auction identifier that will be deleted
    /// @param requireSuccessSeller If NFT maliciously reverts transfers, the bidder's funds can be locked.
    /// This parameter can be set to false not to check NFT transfer results
    /// @param setGasLimitForSellerTransfer If NFT maliciously spends a lot of the gas (or unlimited amount of the gas), the bidder's funds can be locked.
    /// This parameter can be set to true if there is a need in setting gas limit to nft transfer
    /// @param requireSuccessBuyer If bid token maliciously reverts transfers, the seller's funds can be locked.
    /// This parameter can be set to false not to check bid token transfer results
    /// @param setGasLimitForBuyerTransfer If bid token maliciously spends a lot of the gas (or unlimited amount of the gas), the seller's funds can be locked.
    /// This parameter can be set to true if there is a need in setting gas limit to bid token transfer
    function deleteAuction(
        bytes32 auctionId,
        bool requireSuccessSeller,
        bool setGasLimitForSellerTransfer,
        bool requireSuccessBuyer,
        bool setGasLimitForBuyerTransfer
    ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        AuctionData storage _auctionData = auctionData[auctionId];

        address seller = _auctionData.seller;
        require(seller != address(0), "NftMarketplaceV2: No such open auction");

        TokenInfo memory tokenInfo = _auctionData.tokenInfo;
        _tokenTransfer(
            tokenInfo,
            address(this),
            seller,
            requireSuccessSeller,
            setGasLimitForSellerTransfer
        );

        address lastBidder = _auctionData.lastBidder;
        if (lastBidder != address(0)) {
            _tokenTransfer(
                TokenInfo({
                    tokenType: TokenType.ERC20,
                    tokenAddress: _auctionData.bidToken,
                    id: 0,
                    amount: _auctionData.lastBidAmount
                }),
                address(this),
                lastBidder,
                requireSuccessBuyer,
                setGasLimitForBuyerTransfer
            );
        }

        delete auctionData[auctionId];
        _activeAuctions.remove(auctionId);
        isAuctionCompleted[auctionId] = true;

        emit AucitonDeleted(msg.sender, auctionId);
    }

    /// @notice Admin function for pausing/unpausing creation of auctions on the marketplace.
    function togglePause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        bool oldValue = isPausedCreation;
        isPausedCreation = !oldValue;

        emit PauseToggled(msg.sender, oldValue, !oldValue);
    }

    // external view

    /// @notice Function to get the number of active auctions on the contract.
    /// @return Amount of active auctions on the contract
    function activeAuctionsLength() external view returns (uint256) {
        return _activeAuctions.length();
    }

    /// @notice Function to get an element in the _activeAuctions array on the `index` index.
    /// @param index Index in the _activeAuctions array
    /// @return Auction id at index `index` in the array _activeAuctions
    function activeAuctionsAt(uint256 index) external view returns (bytes32) {
        return _activeAuctions.at(index);
    }

    /// @notice Function to find out if a certain auction id is active.
    /// @param auctionId Auction id to check
    /// @return True if auction `auctionId` is active
    function activeAuctionsContains(bytes32 auctionId) external view returns (bool) {
        return _activeAuctions.contains(auctionId);
    }

    // public view

    /// @notice The function of the ERC165 standard.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Receiver, AccessControlEnumerable)
        returns (bool)
    {
        return
            AccessControlEnumerable.supportsInterface(interfaceId) ||
            ERC1155Receiver.supportsInterface(interfaceId);
    }

    // private

    function _tokenTransfer(
        TokenInfo memory tokenInfo,
        address from,
        address to,
        bool requireSuccess,
        bool setGasLimit
    ) private {
        if (tokenInfo.tokenType == TokenType.ERC20) {
            if (tokenInfo.tokenAddress == address(0)) {
                require(
                    from == msg.sender || from == address(this),
                    "NftMarketplaceV2: Wrong from"
                );
                if (from == msg.sender) {
                    require(tokenInfo.amount == msg.value, "NftMarketplaceV2: Wrong amount");

                    if (to != address(this)) {
                        uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_NATIVE_TRANSFER : gasleft();
                        (bool success, bytes memory data) = to.call{
                            value: tokenInfo.amount,
                            gas: gasLimit
                        }("");
                        if (requireSuccess) {
                            require(success, "NftMarketplaceV2: Transfer native");
                        }
                        if (!success) {
                            emit BadTokenTransfer(
                                to,
                                tokenInfo.tokenAddress,
                                tokenInfo.tokenType,
                                tokenInfo.id,
                                tokenInfo.amount,
                                _getRevertMsg(data)
                            );
                        }
                    }
                } else {
                    require(
                        address(this).balance >= tokenInfo.amount,
                        "NftMarketplaceV2: Not enough native balance"
                    );
                    uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_NATIVE_TRANSFER : gasleft();
                    (bool success, bytes memory data) = to.call{
                        value: tokenInfo.amount,
                        gas: gasLimit
                    }("");
                    if (requireSuccess) {
                        require(success, "NftMarketplaceV2: Transfer native");
                    }
                    if (!success) {
                        emit BadTokenTransfer(
                            to,
                            tokenInfo.tokenAddress,
                            tokenInfo.tokenType,
                            tokenInfo.id,
                            tokenInfo.amount,
                            _getRevertMsg(data)
                        );
                    }
                }
            } else {
                if (from == msg.sender) {
                    require(msg.value == 0, "NftMarketplaceV2: Not native, need no value");
                }
                if (from == address(this)) {
                    uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_TOKEN_TRANSFER : gasleft();
                    (bool success, bytes memory data) = tokenInfo.tokenAddress.call{gas: gasLimit}(
                        abi.encodeWithSelector(IERC20.transfer.selector, to, tokenInfo.amount)
                    );
                    bool isSucceeded = _checkTransferResult(success, data);
                    if (requireSuccess) {
                        require(
                            isSucceeded,
                            success
                                ? "NftMarketplaceV2: ERC20 transfer result false"
                                : _getRevertMsg(data)
                        );
                    } else if (!isSucceeded) {
                        string memory errorMessage = success
                            ? "NftMarketplaceV2: ERC20 transfer result false"
                            : _getRevertMsg(data);
                        emit BadTokenTransfer(
                            to,
                            tokenInfo.tokenAddress,
                            tokenInfo.tokenType,
                            tokenInfo.id,
                            tokenInfo.amount,
                            errorMessage
                        );
                    }
                } else {
                    uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_TOKEN_TRANSFER : gasleft();
                    (bool success, bytes memory data) = tokenInfo.tokenAddress.call{gas: gasLimit}(
                        abi.encodeWithSelector(
                            IERC20.transferFrom.selector,
                            from,
                            to,
                            tokenInfo.amount
                        )
                    );
                    bool isSucceeded = _checkTransferResult(success, data);
                    if (requireSuccess) {
                        require(
                            isSucceeded,
                            success
                                ? "NftMarketplaceV2: ERC20 transfer result false"
                                : _getRevertMsg(data)
                        );
                    } else if (!isSucceeded) {
                        string memory errorMessage = success
                            ? "NftMarketplaceV2: ERC20 transferFrom result false"
                            : _getRevertMsg(data);
                        emit BadTokenTransfer(
                            to,
                            tokenInfo.tokenAddress,
                            tokenInfo.tokenType,
                            tokenInfo.id,
                            tokenInfo.amount,
                            errorMessage
                        );
                    }
                }
            }
        } else if (tokenInfo.tokenType == TokenType.ERC721) {
            uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_TOKEN_TRANSFER : gasleft();
            (bool success, bytes memory data) = tokenInfo.tokenAddress.call{gas: gasLimit}(
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256)",
                    from,
                    to,
                    tokenInfo.id
                )
            );
            if (requireSuccess) {
                require(success, _getRevertMsg(data));
            } else if (!success) {
                emit BadTokenTransfer(
                    to,
                    tokenInfo.tokenAddress,
                    tokenInfo.tokenType,
                    tokenInfo.id,
                    tokenInfo.amount,
                    _getRevertMsg(data)
                );
            }
        } else if (tokenInfo.tokenType == TokenType.ERC1155) {
            uint256 gasLimit = setGasLimit ? _MAX_GAS_FOR_TOKEN_TRANSFER : gasleft();
            (bool success, bytes memory data) = tokenInfo.tokenAddress.call{gas: gasLimit}(
                abi.encodeWithSelector(
                    IERC1155.safeTransferFrom.selector,
                    from,
                    to,
                    tokenInfo.id,
                    tokenInfo.amount,
                    ""
                )
            );
            if (requireSuccess) {
                require(success, _getRevertMsg(data));
            } else if (!success) {
                emit BadTokenTransfer(
                    to,
                    tokenInfo.tokenAddress,
                    tokenInfo.tokenType,
                    tokenInfo.id,
                    tokenInfo.amount,
                    _getRevertMsg(data)
                );
            }
        }
    }

    function _tokenTransferWithFee(
        TokenInfo memory tokenInfo,
        address from,
        address to,
        address royaltyReceiver,
        uint256 royaltyAmount
    ) private {
        if (tokenInfo.tokenType == TokenType.ERC20) {
            uint256 feeAmount = (tokenInfo.amount * feePercentage) / 100_00;

            // not more than 50%
            if (royaltyAmount > tokenInfo.amount / 2) {
                royaltyAmount = tokenInfo.amount / 2;
            }

            uint256 transferAmount = tokenInfo.amount - feeAmount - royaltyAmount;
            if (transferAmount > 0) {
                _tokenTransfer(
                    TokenInfo({
                        tokenType: TokenType.ERC20,
                        tokenAddress: tokenInfo.tokenAddress,
                        id: 0,
                        amount: transferAmount
                    }),
                    from,
                    to,
                    true,
                    false
                );
            }

            if (feeAmount > 0) {
                address _feeReceiver = feeReceiver;
                _tokenTransfer(
                    TokenInfo({
                        tokenType: TokenType.ERC20,
                        tokenAddress: tokenInfo.tokenAddress,
                        id: 0,
                        amount: feeAmount
                    }),
                    from,
                    _feeReceiver,
                    true,
                    false
                );

                emit FeeTransferred(_feeReceiver, tokenInfo.tokenAddress, feeAmount);
            }

            if (royaltyAmount > 0) {
                _tokenTransfer(
                    TokenInfo({
                        tokenType: TokenType.ERC20,
                        tokenAddress: tokenInfo.tokenAddress,
                        id: 0,
                        amount: royaltyAmount
                    }),
                    from,
                    royaltyReceiver,
                    true,
                    false
                );

                emit RoyaltyTransferred(royaltyReceiver, tokenInfo.tokenAddress, royaltyAmount);
            }
        } else {
            _tokenTransfer(tokenInfo, from, to, true, false);
        }
    }

    // private view

    function _verifyToken(TokenInfo calldata tokenInfo) private view {
        require(tokenInfo.tokenAddress.isContract(), "NftMarketplaceV2: Not a contract");
        if (tokenInfo.tokenType == TokenType.ERC20) {
            require(tokenInfo.id == 0, "NftMarketplaceV2: ERC20 id");
            require(tokenInfo.amount > 0, "NftMarketplaceV2: ERC20 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC721) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0x80ac58cd)),
                "NftMarketplaceV2: ERC721 type"
            );
            require(tokenInfo.amount == 0, "NftMarketplaceV2: ERC721 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC1155) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0xd9b67a26)),
                "NftMarketplaceV2: ERC1155 type"
            );
            require(tokenInfo.amount > 0, "NftMarketplaceV2: ERC1155 amount");
        }
    }

    // private pure

    function _getAuctionId(AuctionData memory _auctionData) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    _auctionData.tokenInfo,
                    _auctionData.seller,
                    _auctionData.startTime,
                    _auctionData.endTime,
                    _auctionData.minPrice,
                    _auctionData.bidToken
                )
            );
    }

    function _checkTransferResult(bool success, bytes memory data) private pure returns (bool) {
        return success && (data.length > 0 ? abi.decode(data, (bool)) : true);
    }

    function _getRevertMsg(bytes memory revertData)
        private
        pure
        returns (string memory errorMessage)
    {
        // revert data format:
        // 4 bytes - Function selector for Error(string)
        // 32 bytes - Data offset
        // 32 bytes - String length
        // other - String data

        // If the revertData length is less than 68, then the transaction failed silently (without a revert message)
        if (revertData.length <= 68) return "";

        uint256 index = revertData.length - 1;
        while (index > 68 && revertData[index] == bytes1(0)) {
            index--;
        }
        uint256 numberOfZeroElements = revertData.length - 1 - index;

        uint256 errorLength = revertData.length - 68 - numberOfZeroElements;
        bytes memory rawErrorMessage = new bytes(errorLength);

        for (uint256 i = 0; i < errorLength; ++i) {
            rawErrorMessage[i] = revertData[i + 68];
        }
        errorMessage = string(rawErrorMessage);
    }
}
