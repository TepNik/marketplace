# Solidity API

## NftMarketplace

### isOrderCompleted

```solidity
mapping(bytes32 => bool) isOrderCompleted
```

Holds information about whether an order is completed or not.

### wNative

```solidity
address wNative
```

Address of the WNative ERC20 token.

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

### isPaused

```solidity
bool isPaused
```

Shows if the marketplace is paused by an admin.

### MAX_GAS_FOR_NATIVE_TRANSFER

```solidity
uint256 MAX_GAS_FOR_NATIVE_TRANSFER
```

### SwapMade

```solidity
event SwapMade(struct EIP712.SignatureInfo signatureInfo, address seller, address buyer, bytes32 orderId)
```

Event is emitted when an order is completed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| signatureInfo | struct EIP712.SignatureInfo | Info about an order. More info about this structure can be found in makeSwap() function. |
| seller | address | Address that sold their tokens. |
| buyer | address | This address signed the swap transaction. |
| orderId | bytes32 | Unique identifier for this order. |

### FeeTransferred

```solidity
event FeeTransferred(address feeReceiver, address token, uint256 amount)
```

Event is emitted when fees of the marketplace were transferred.

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeReceiver | address | Address that received fees. |
| token | address | Address of a token that was transfered. |
| amount | uint256 | Fee amount. |

### RoyaltyTransferred

```solidity
event RoyaltyTransferred(address royaltyReceiver, address token, uint256 amount)
```

Event is emitted when royalties were transferred.

| Name | Type | Description |
| ---- | ---- | ----------- |
| royaltyReceiver | address | Address that received royalties. |
| token | address | Address of a token that was transfered. |
| amount | uint256 | Royalty amount. |

### FeePercentageChange

```solidity
event FeePercentageChange(address manager, uint256 oldValue, uint256 newValue)
```

Event is emitted when an admin (`manager`) has set new fee percentages for the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of the admin that has changed fee percentages for the marketplace. |
| oldValue | uint256 | Previous value of fee percentages for the marketplace. |
| newValue | uint256 | New value of fee percentages for the marketplace. |

### FeeReceiverChange

```solidity
event FeeReceiverChange(address manager, address oldValue, address newValue)
```

Event is emitted when an admin (`manager`) has set new fee receiver for the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that has changed fee receiver for the marketplace. |
| oldValue | address | Previous fee receiver of the marketplace. |
| newValue | address | New fee receiver of the marketplace. |

### SwapsPaused

```solidity
event SwapsPaused(address manager)
```

Event is emitted when an admin (`manager`) has paused the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that has paused the marketplace. |

### SwapsUnpaused

```solidity
event SwapsUnpaused(address manager)
```

Event is emitted when an admin (`manager`) has unpaused the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of an admin that has unpaused the marketplace. |

### constructor

```solidity
constructor(address _feeReceiver, address _wnative) public
```

Constructor of the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _feeReceiver | address | Address of a fee receiver of the marketplace. |
| _wnative | address | Address of the WNative ERC20 token. |

### setFeePercentage

```solidity
function setFeePercentage(uint256 newValue) external
```

Admin funciton for setting new value for fee percentages of the marketplace.

| Name | Type | Description |
| ---- | ---- | ----------- |
| newValue | uint256 | New value of the marketplace fee percentages. |

### setFeeReceiver

```solidity
function setFeeReceiver(address newValue) external
```

Admin function for setting new value for the marketplace's fee receiver.

| Name | Type | Description |
| ---- | ---- | ----------- |
| newValue | address | New value of the marketplace's fee receiver. |

### togglePause

```solidity
function togglePause() external
```

Admin function for pausing/unpausing the marketplace.

### makeSwap

```solidity
function makeSwap(struct EIP712.SignatureInfo signatureInfoSeller, bytes sellerSignature, address sellerAddress) external payable
```

Function for performing swap and completing an order.

| Name | Type | Description |
| ---- | ---- | ----------- |
| signatureInfoSeller | struct EIP712.SignatureInfo |  |
| sellerSignature | bytes | Signature of a seller. Signing message has to be the first argument (`signatureInfoSeller`). |
| sellerAddress | address | Address of a seller. |

### _verifyToken

```solidity
function _verifyToken(struct EIP712.TokenInfo tokenInfo) private view
```

### _tokenTransfer

```solidity
function _tokenTransfer(struct EIP712.TokenInfo tokenInfo, address from, address to, address royaltyReceiver, uint256 royaltyAmount) private
```

