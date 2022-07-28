# Solidity API

## RoyaltiesInfo

### RoyaltyInfo

```solidity
struct RoyaltyInfo {
  bool isEnabled;
  address royaltyReceiver;
  uint16 royaltyPercentage;
}
```

### ROYALTY_MANAGER

```solidity
bytes32 ROYALTY_MANAGER
```

Role that manages royalties info

### royaltiesInfo

```solidity
mapping(address => struct RoyaltiesInfo.RoyaltyInfo) royaltiesInfo
```

Holds information about royalties that are set by an admin.
Can be changed in functions setRoyalty() and disableAdminRoyalty().

### defaultFeeForOwner

```solidity
uint16 defaultFeeForOwner
```

Amount of royalties in percent (denominator 10000) for a collection in case when royalty receiver is the owner of the collection. Max value can be 1000 (10%).
Can be changed in setDefaultFeeForOwner() function.

### AddedAdminRoyalty

```solidity
event AddedAdminRoyalty(address manager, address token, address royaltyReceiver, uint16 royaltyPercentage)
```

Event is emitted when an admin of the contract (`manager`) has added a new royalty config (`royaltyReceiver` will receive `royaltyPercentage` percentages) for a collection `token`.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Admin of the contract that has set a new royalty config for a collection `token`. |
| token | address | Address of a collection. |
| royaltyReceiver | address | Address that will receive all royalties for the collection `token`. |
| royaltyPercentage | uint16 | Amount of percentages for royalties for the collection `token` (denominator 10000). |

### DisabledAdminRoyalty

```solidity
event DisabledAdminRoyalty(address manager, address token)
```

Event is emitted when an admin of the contract (`manager`) has deleted royalty config for a collection `token`.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Admin of the contract that has deleted royalty config for a collection `token`. |
| token | address | Address of a collection. |

### ChangedDefaultFeeForOwner

```solidity
event ChangedDefaultFeeForOwner(address manager, uint256 oldValue, uint256 newValue)
```

Event is emitted when an admin of the contract (`manager`) has changed value for defaultFeeForOwner variable from `oldValue` to `newValue`.

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Admin of the contract that has changed value for defaultFeeForOwner variable from `oldValue` to `newValue`. |
| oldValue | uint256 | Previous value of defaultFeeForOwner variable. |
| newValue | uint256 | New value for defaultFeeForOwner variable. |

### constructor

```solidity
constructor() public
```

### setRoyalty

```solidity
function setRoyalty(address token, address royaltyReceiver, uint16 royaltyPercentage) external
```

Admin function (ROYALTY_MANAGER role) for setting royalty config for a collection `token`.

_Changes mapping royaltiesInfo._

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of a collection (only ERC721 and ERC1155). |
| royaltyReceiver | address | Address that will collect all the royalties for the collection `token`. |
| royaltyPercentage | uint16 | Percentage for royalties for the collection `token` (denominator 10000). Max value can be 1000 (10%). |

### setDefaultFeeForOwner

```solidity
function setDefaultFeeForOwner(uint16 newValue) external
```

Admin function (ROYALTY_MANAGER role) for setting new value (`newValue`) for defaultFeeForOwner variable.

_Changes variable defaultFeeForOwner._

| Name | Type | Description |
| ---- | ---- | ----------- |
| newValue | uint16 | New value for variable defaultFeeForOwner. |

### disableAdminRoyalty

```solidity
function disableAdminRoyalty(address token) external
```

Admin function (ROYALTY_MANAGER role) for deleting royalty config for a collection `token`.

_Changes mapping royaltiesInfo._

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of a collection. |

### getRoyaltyInfo

```solidity
function getRoyaltyInfo(address token, uint256 tokenId, uint256 salePrice) public view returns (address royaltyReceiver, uint256 royaltyAmount)
```

Function for getting royalty info for a collection `token`.

_Priority for royalty source:
1) Royalty config;
2) Info from ERC2981 standard;
3) Owner of a collection.
If a collection doesn't have any of these items, there will be no royalties for the colleciton._

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of a colleciton. |
| tokenId | uint256 | Id of a collection that is sold. |
| salePrice | uint256 | Sale price for this `tokenId`. |

| Name | Type | Description |
| ---- | ---- | ----------- |
| royaltyReceiver | address | Address that will receive royalties for collection `token`. |
| royaltyAmount | uint256 | Amount of royalty in tokens. |

