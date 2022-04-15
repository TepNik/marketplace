// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.12;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract RoyaltiesInfo is AccessControlEnumerable {
    using Address for address;

    struct RoyaltyInfo {
        bool isEnabled;
        address royaltyReceiver;
        uint16 royaltyPercentage;
    }

    mapping(address => RoyaltyInfo) public royaltiesInfo;

    event AddedAdminRoyalty(
        address indexed manager,
        address token,
        address royaltyReceiver,
        uint16 royaltyPercentage
    );
    event DisabledAdminRoyalty(address indexed manager, address token);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

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

        royaltiesInfo[token].isEnabled = true;
        royaltiesInfo[token].royaltyReceiver = royaltyReceiver;
        royaltiesInfo[token].royaltyPercentage = royaltyPercentage;

        emit AddedAdminRoyalty(msg.sender, token, royaltyReceiver, royaltyPercentage);
    }

    function disableAdminRoyalty(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(royaltiesInfo[token].isEnabled == true, "RoyaltiesInfo: Disabled");

        delete royaltiesInfo[token];

        emit DisabledAdminRoyalty(msg.sender, token);
    }

    function getRoyaltyInfo(address token) public view returns (address, uint256) {
        RoyaltyInfo memory royaltyInfoToken = royaltiesInfo[token];
        if (royaltyInfoToken.isEnabled) {
            return (royaltyInfoToken.royaltyReceiver, royaltyInfoToken.royaltyPercentage);
        } else {
            try Ownable(token).owner() returns (address owner) {
                return (owner, 2_50); // 2.50%
            } catch (bytes memory) {
                return (address(0), 0);
            }
        }
    }
}
