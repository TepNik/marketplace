// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @title Contract that implements functionality for fetching info about royalties for a collection.
contract RoyaltiesInfo is AccessControlEnumerable {
    using Address for address;

    struct RoyaltyInfo {
        bool isEnabled;
        address royaltyReceiver;
        uint16 royaltyPercentage;
    }

    /// @notice Holds an information about royalties that are set by an admin.
    /// Can be changed in functions setRoyalty() and disableAdminRoyalty().
    mapping(address => RoyaltyInfo) public royaltiesInfo;

    /// @notice Amount of royalties in percent (denominator 10000) for a collection in case when royalty receiver is the owner of the collection. Max value can be 1000 (10%).
    /// Can be changed in setDefaultFeeForOwner() function.
    uint256 public defaultFeeForOwner = 2_50; // 2.5%

    /// @notice Event is emmited when an admin of the contract (`manager`) has added a new royalty config (`royaltyReceiver` will receive `royaltyPercentage` percentages) for a collection `token`.
    /// @param manager Admin of the contract that has set a new royalty config for a collection `token`.
    /// @param token Address of a collection.
    /// @param royaltyReceiver Address that will receive all royalties for the collection `token`.
    /// @param royaltyPercentage Amount of percentages for royalties for the collection `token` (denominator 10000).
    event AddedAdminRoyalty(
        address indexed manager,
        address indexed token,
        address indexed royaltyReceiver,
        uint16 royaltyPercentage
    );

    /// @notice Event is emmited when an admin of the contract (`manager`) has deleted royalty config for a collection `token`.
    /// @param manager Admin of the contract that has deleted royalty config for a collection `token`.
    /// @param token Address of a collection.
    event DisabledAdminRoyalty(address indexed manager, address indexed token);

    /// @notice Event is emmited when an admin of the contract (`manager`) has changed value for defaultFeeForOwner variable from `oldValue` to `newValue`.
    /// @param manager Admin of the contract that has changed value for defaultFeeForOwner variable from `oldValue` to `newValue`.
    /// @param oldValue Previous value of defaultFeeForOwner variable.
    /// @param newValue New value for defaultFeeForOwner variable.
    event ChangedDefaultFeeForOwner(address indexed manager, uint256 oldValue, uint256 newValue);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        emit ChangedDefaultFeeForOwner(msg.sender, 0, defaultFeeForOwner);
    }

    /// @notice Admin function for setting royalty config for a collection `token`.
    /// @dev Changes mapping royaltiesInfo.
    /// @param token Address of a collection (only ERC721 and ERC1155).
    /// @param royaltyReceiver Address that will collect all the royalties for the collection `token`.
    /// @param royaltyPercentage Percentage for royalties for the collection `token` (denominator 10000). Max value can be 1000 (10%).
    function setRoyalty(
        address token,
        address royaltyReceiver,
        uint16 royaltyPercentage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token.isContract(), "RoyaltiesInfo: Not a contract");
        // 0x80ac58cd - ERC721
        // 0xd9b67a26 - ERC1155
        require(
            IERC165(token).supportsInterface(bytes4(0x80ac58cd)) ||
                IERC165(token).supportsInterface(bytes4(0xd9b67a26)),
            "RoyaltiesInfo: Wrong interface"
        );

        require(royaltyPercentage <= 10_00, "RoyaltiesInfo: Percentage"); // 10%
        require(royaltyReceiver != address(0), "RoyaltiesInfo: royaltyReceiver");

        royaltiesInfo[token] = RoyaltyInfo({
            isEnabled: true,
            royaltyReceiver: royaltyReceiver,
            royaltyPercentage: royaltyPercentage
        });

        emit AddedAdminRoyalty(msg.sender, token, royaltyReceiver, royaltyPercentage);
    }

    /// @notice Admin function for setting new value (`newValue`) for defaultFeeForOwner variable.
    /// @dev Changes variable defaultFeeForOwner.
    /// @param newValue New value for variable defaultFeeForOwner.
    function setDefaultFeeForOwner(uint256 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue <= 10_00, "NftMarketplace: Too big percent"); // 10%

        uint256 oldValue = defaultFeeForOwner;
        require(oldValue != newValue, "NftMarketplace: No change");
        defaultFeeForOwner = newValue;

        emit ChangedDefaultFeeForOwner(msg.sender, oldValue, newValue);
    }

    /// @notice Admin function for deleting royaly config for a collection `token`.
    /// @dev Changes mapping royaltiesInfo.
    /// @param token Address of a collection.
    function disableAdminRoyalty(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(royaltiesInfo[token].isEnabled == true, "RoyaltiesInfo: Disabled");

        delete royaltiesInfo[token];

        emit DisabledAdminRoyalty(msg.sender, token);
    }

    /// @notice Function for getting royalty info for a collection `token`.
    /// @dev Priority for royalty source:
    /// 1) Royalty config;
    /// 2) Info from ERC2981 standard;
    /// 3) Owner of a collection.
    /// If a collection doesn't have any of these items, there will be no royalties for the colleciton.
    /// @param token Address of a colleciton.
    /// @param tokenId Id of a collection that is sold.
    /// @param salePrice Sale price for this `tokenId`.
    /// @return Address that will receive royalties for collection `token`.
    /// @return Amount of royaly in tokens.
    function getRoyaltyInfo(
        address token,
        uint256 tokenId,
        uint256 salePrice
    ) public view returns (address, uint256) {
        RoyaltyInfo memory royaltyInfoToken = royaltiesInfo[token];
        if (royaltyInfoToken.isEnabled) {
            return (
                royaltyInfoToken.royaltyReceiver,
                (royaltyInfoToken.royaltyPercentage * salePrice) / 100_00
            );
        } else {
            try IERC2981(token).royaltyInfo(tokenId, salePrice) returns (
                address receiver,
                uint256 amount
            ) {
                return (receiver, amount);
            } catch (bytes memory) {}

            try Ownable(token).owner() returns (address owner) {
                return (owner, (defaultFeeForOwner * salePrice) / 100_00);
            } catch (bytes memory) {
                return (address(0), 0);
            }
        }
    }
}
