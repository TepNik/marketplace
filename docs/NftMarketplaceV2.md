# Solidity API

## NftMarketplaceV2

### TokenType

```solidity
enum TokenType {
  ERC20,
  ERC721,
  ERC1155
}
```

### TokenInfo

```solidity
struct TokenInfo {
  enum NftMarketplaceV2.TokenType tokenType;
  address tokenAddress;
  uint256 id;
  uint256 amount;
}
```

### AuctionData

```solidity
struct AuctionData {
  struct NftMarketplaceV2.TokenInfo tokenInfo;
  address seller;
  uint32 startTime;
  uint32 endTime;
  uint256 minPrice;
  address bidToken;
  uint256 lastBidAmount;
  address lastBidder;
}
```

### isPausedCreation

```solidity
bool isPausedCreation
```

True if the creation of new auctions is paused by an admin.

### auctionData

```solidity
mapping(bytes32 => struct NftMarketplaceV2.AuctionData) auctionData
```

Get information for an auction.

### isAuctionCompleted

```solidity
mapping(bytes32 => bool) isAuctionCompleted
```

Check if some auction has already been completed or not.

### feePercentage

```solidity
uint256 feePercentage
```

Fee percentage of the marketplace (denominator 10000). Max value is 1000 (10%).

### feeReceiver

```solidity
address feeReceiver
```

Address that will receive all marketplace fees.

### _activeAuctions

```solidity
struct EnumerableSet.Bytes32Set _activeAuctions
```

### _MAX_GAS_FOR_NATIVE_TRANSFER

```solidity
uint256 _MAX_GAS_FOR_NATIVE_TRANSFER
```

### _MAX_GAS_FOR_TOKEN_TRANSFER

```solidity
uint256 _MAX_GAS_FOR_TOKEN_TRANSFER
```

### FeeTransferred

```solidity
event FeeTransferred(address feeReceiver, address token, uint256 amount)
```

The event is emitted when fees of the marketplace were transferred.

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeReceiver | address | Address that received fees |
| token | address | Address of a token that was transferred |
| amount | uint256 | Fee amount |

### RoyaltyTransferred

```solidity
event RoyaltyTransferred(address royaltyReceiver, address token, uint256 amount)
```

The event is emitted when royalties were transferred.

| Name | Type | Description |
| ---- | ---- | ----------- |
| royaltyReceiver | address | Address that received royalties |
| token | address | Address of a token that was transferred |
| amount | uint256 | Royalty amount |

### FeePercentageChange

```solidity
event FeePercentageChange(address manager, uint256 oldValue, uint256 newValue)
```

The event is emitted when an admin (`manager`) has set new fee percentages (`newValue`) for the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of the admin that has changed fee percentages for the marketplace |
| oldValue | uint256 | Previous value of fee percentages for the marketplace |
| newValue | uint256 | New value of fee percentages for the marketplace |

### FeeReceiverChange

```solidity
event FeeReceiverChange(address manager, address oldValue, address newValue)
```

The event is emitted when an admin (`manager`) has set a new fee receiver (`newValue`) for the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that has changed fee receiver for the marketplace |
| oldValue | address | Previous fee receiver of the marketplace |
| newValue | address | New fee receiver of the marketplace |

### AuctoinCreated

```solidity
event AuctoinCreated(address user, struct NftMarketplaceV2.TokenInfo tokenInfo, uint256 startTime, uint256 endTime, uint256 minPrice, address bidToken, bytes32 auctionId)
```

The event is emitted when `user` creates a new auction (`auctionId`) to sell his nft.

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User that creates auction |
| tokenInfo | struct NftMarketplaceV2.TokenInfo | Information about NFT that user puts on sale |
| startTime | uint256 | Time when the auction will start |
| endTime | uint256 | Time when the auction will end |
| minPrice | uint256 | Minimum price in token `bidToken` |
| bidToken | address | Address of a token that will be accepted for a bid (0x0 address is used for the native token) |
| auctionId | bytes32 | Unique identifier for this new auction |

### BidMade

```solidity
event BidMade(bytes32 auctionId, address user, address bidToken, uint256 bidAmount)
```

The event is emitted when `user` makes a bid on the auction (`auctionId`).

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier for which `user` makes a bid |
| user | address | User that makes a bid |
| bidToken | address | Address of the token that bids `user` (0x0 address is used for the native token) |
| bidAmount | uint256 | Amount of the bid |

### BidRefund

```solidity
event BidRefund(bytes32 auctionId, address user, address bidToken, uint256 bidAmount)
```

The event is emitted when to the auction (`auctionId`) comes a new bid with a bigger amount of the bid.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier in which `user` made the bid |
| user | address | User that gets his bid back |
| bidToken | address | Address of the token that will be refunded to the `user` (0x0 address is used for the native token) |
| bidAmount | uint256 | Amount of refund |

### AuctionCalceled

```solidity
event AuctionCalceled(bytes32 auctionId, address seller, struct NftMarketplaceV2.TokenInfo tokenInfo)
```

The event is emitted when `seller` cancels his auction (`auctionId`).
It may happen when to this auction there wasn't any bid made and
for this auction function {endAuction} was called.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier which was canceled |
| seller | address | User that created an auction |
| tokenInfo | struct NftMarketplaceV2.TokenInfo | Token info for NFT that was selling in this auction |

### AuctionEnded

```solidity
event AuctionEnded(bytes32 auctionId, address seller, address buyer, struct NftMarketplaceV2.TokenInfo tokenInfoSell, struct NftMarketplaceV2.TokenInfo tokenInfoBid)
```

The event is emitted when the auction (`auctionId`) was successfully closed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier which was successfully closed |
| seller | address | User that sells NFT |
| buyer | address | User that buys NFT |
| tokenInfoSell | struct NftMarketplaceV2.TokenInfo | Token info for NFT |
| tokenInfoBid | struct NftMarketplaceV2.TokenInfo | Token info for bid token (0x0 address is used for the native token) |

### PauseToggled

```solidity
event PauseToggled(address manager, bool oldValue, bool newValue)
```

The event is emitted when an admin (`manager`) toggles the pause of the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that made this swap |
| oldValue | bool | Previous value of the pause |
| newValue | bool | New value of the pause |

### AucitonDeleted

```solidity
event AucitonDeleted(address manager, bytes32 auctionId)
```

The event is emitted when an admin (`manager`) deletes an auction (`auctionId`).

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that deleted the auction |
| auctionId | bytes32 | Auction identifier which was deleted |

### BadTokenTransfer

```solidity
event BadTokenTransfer(address to, address tokenAddress, enum NftMarketplaceV2.TokenType tokenType, uint256 id, uint256 amount, string errorString)
```

The event is emitted when token transfer failed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | Receiver address |
| tokenAddress | address | Token address |
| tokenType | enum NftMarketplaceV2.TokenType | Type of the token (ERC20 = 0, ERC721 = 1, ERC1155 = 2) |
| id | uint256 | Token id that were tried to transfer. For ERC20 it will be zero |
| amount | uint256 | Amount of the token. For ERC721 it will be zero |
| errorString | string | Error message of the transfer. For ERC20 it can be "NftMarketplaceV2: ERC20 transfer result false" means that transfer succedded but the result is false |

### BadNativeTokenTransfer

```solidity
event BadNativeTokenTransfer(address to, uint256 amount, string errorString)
```

The event is emitted when transfer of the native token failed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | Receiver address |
| amount | uint256 | Amount of the token. For ERC721 it will be zero |
| errorString | string | Error message of the transfer |

### constructor

```solidity
constructor(address _feeReceiver) public
```

The constructor of the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _feeReceiver | address | Address of a fee receiver of the marketplace |

### createAuction

```solidity
function createAuction(struct NftMarketplaceV2.TokenInfo tokenInfo, uint32 startTime, uint32 endTime, uint256 minPrice, address bidToken) external returns (bytes32 auctionId)
```

Create a new auction.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenInfo | struct NftMarketplaceV2.TokenInfo | Token info for the NFT that will be placed on sale |
| startTime | uint32 | Time when this auction will start |
| endTime | uint32 | Time when this auction will end |
| minPrice | uint256 | Minimum price for this NFT |
| bidToken | address | Address of the token that will be accepted for bids (0x0 address is used for the native token) |

### bid

```solidity
function bid(bytes32 auctionId, uint256 amount) external payable
```

Make a bid to the auction with id `auctionId`.
If auction has (bidToken == 0x0) then `amount` should be added to the value of tx
else the value of tx should be zero.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier to which the bid will be made |
| amount | uint256 | Amount of the bid |

### endAuction

```solidity
function endAuction(bytes32 auctionId) external
```

Function for ending the auction. Can be called only when endTime of an auction has passed.
If there are no bids, NFT will be refunded to a seller of an auction.
If there is a bid, an auction will be processed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier that will be ended |

### setFeePercentage

```solidity
function setFeePercentage(uint256 newValue) external
```

Admin function for setting a new value for fee percentages of the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| newValue | uint256 | New value of the marketplace fee percentages |

### setFeeReceiver

```solidity
function setFeeReceiver(address newValue) external
```

Admin function for setting a new value for the marketplace's fee receiver.

| Name | Type | Description |
| ---- | ---- | ----------- |
| newValue | address | New value of the marketplace's fee receiver |

### deleteAuction

```solidity
function deleteAuction(bytes32 auctionId, bool requireSuccessSeller, bool setGasLimitForSellerTransfer, bool requireSuccessBuyer, bool setGasLimitForBuyerTransfer) external
```

Admin function for deleting auction (`auctionId`) is case of
wrong parameters and if NFT or a bid token reverts token transfer (or gas ddos).

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction identifier that will be deleted |
| requireSuccessSeller | bool | If NFT maliciously reverts transfers, the bidder's funds can be locked. This parameter can be set to false not to check NFT transfer results |
| setGasLimitForSellerTransfer | bool | If NFT maliciously spends a lot of the gas (or unlimited amount of the gas), the bidder's funds can be locked. This parameter can be set to true if there is a need in setting gas limit to nft transfer |
| requireSuccessBuyer | bool | If bid token maliciously reverts transfers, the seller's funds can be locked. This parameter can be set to false not to check bid token transfer results |
| setGasLimitForBuyerTransfer | bool | If bid token maliciously spends a lot of the gas (or unlimited amount of the gas), the seller's funds can be locked. This parameter can be set to true if there is a need in setting gas limit to bid token transfer |

### togglePause

```solidity
function togglePause() external
```

Admin function for pausing/unpausing creation of auctions on the marketplace.

### activeAuctionsLength

```solidity
function activeAuctionsLength() external view returns (uint256)
```

Function to get the number of active auctions on the contract.

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Amount of active auctions on the contract |

### activeAuctionsAt

```solidity
function activeAuctionsAt(uint256 index) external view returns (bytes32)
```

Function to get an element in the _activeAuctions array on the `index` index.

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | Index in the _activeAuctions array |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Auction id at index `index` in the array _activeAuctions |

### activeAuctionsContains

```solidity
function activeAuctionsContains(bytes32 auctionId) external view returns (bool)
```

Function to find out if a certain auction id is active.

| Name | Type | Description |
| ---- | ---- | ----------- |
| auctionId | bytes32 | Auction id to check |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if auction `auctionId` is active |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

The function of the ERC165 standard.

### _tokenTransfer

```solidity
function _tokenTransfer(struct NftMarketplaceV2.TokenInfo tokenInfo, address from, address to, bool requireSuccess, bool setGasLimit) private
```

### _tokenTransferWithFee

```solidity
function _tokenTransferWithFee(struct NftMarketplaceV2.TokenInfo tokenInfo, address from, address to, address royaltyReceiver, uint256 royaltyAmount) private
```

### _verifyToken

```solidity
function _verifyToken(struct NftMarketplaceV2.TokenInfo tokenInfo) private view
```

### _getAuctionId

```solidity
function _getAuctionId(struct NftMarketplaceV2.AuctionData _auctionData) private pure returns (bytes32)
```

### _checkTransferResult

```solidity
function _checkTransferResult(bool success, bytes data) private pure returns (bool)
```

### _getRevertMsg

```solidity
function _getRevertMsg(bytes revertData) private pure returns (string errorMessage)
```

