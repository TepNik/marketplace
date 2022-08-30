// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract TestERC721WithERC2981 is ERC721("Test721", "TST721"), IERC2981 {
    bool public isReturnBadValue;
    address public receiver;
    uint16 public defaultFee = 5_00;

    function returnBadValue() external {
        isReturnBadValue = !isReturnBadValue;
    }

    function setReceiver(address newValue) external {
        receiver = newValue;
    }

    function mint(uint256 id) external {
        _mint(msg.sender, id);
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address royaltyReceiver, uint256 royaltyAmount)
    {
        tokenId;
        if (isReturnBadValue) {
            return (receiver, type(uint256).max);
        }
        return (receiver, (defaultFee * salePrice) / 100_00);
    }
}
