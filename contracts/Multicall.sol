// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./NftMarketplace.sol";

contract Multicall {
    using Address for address;

    NftMarketplace public immutable nftMarketplace;

    constructor(NftMarketplace _nftMarketplace) {
        nftMarketplace = _nftMarketplace;
    }

    function verifyOrder(
        bytes32 orderid,
        NftMarketplace.TokenInfo calldata tokenToGet,
        address tokenToGetUser,
        NftMarketplace.TokenInfo calldata tokenToGive,
        address tokenToGiveUser
    )
        external
        view
        returns (
            bool isOrderComplited,
            bool isTokenToGetGood,
            bool isTokenToGiveGood
        )
    {
        isOrderComplited = nftMarketplace.isOrderComplited(orderid);

        isTokenToGetGood = checkTokenInfo(tokenToGet, tokenToGetUser);

        isTokenToGiveGood = checkTokenInfo(tokenToGive, tokenToGiveUser);
    }

    function checkTokenInfo(NftMarketplace.TokenInfo calldata tokenInfo, address tokenUser)
        public
        view
        returns (bool)
    {
        if (!tokenInfo.tokenAddress.isContract()) {
            return false;
        }

        if (tokenInfo.tokenType == NftMarketplace.TokenType.ERC20) {
            if (tokenInfo.id != 0 || tokenInfo.amount == 0) {
                return false;
            }

            if (tokenUser != address(0)) {
                uint256 balance = IERC20(tokenInfo.tokenAddress).balanceOf(tokenUser);
                if (balance < tokenInfo.amount) {
                    return false;
                }

                uint256 allowance = IERC20(tokenInfo.tokenAddress).allowance(
                    tokenUser,
                    address(nftMarketplace)
                );
                if (allowance < tokenInfo.amount) {
                    return false;
                }
            }
        } else if (tokenInfo.tokenType == NftMarketplace.TokenType.ERC721) {
            if (tokenInfo.amount != 0) {
                return false;
            }

            if (!IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0x80ac58cd))) {
                return false;
            }

            if (tokenUser != address(0)) {
                address idOwner = IERC721(tokenInfo.tokenAddress).ownerOf(tokenInfo.id);

                if (idOwner != tokenUser) {
                    return false;
                }

                bool isApprovedForAll = IERC721(tokenInfo.tokenAddress).isApprovedForAll(
                    tokenUser,
                    address(nftMarketplace)
                );
                if (!isApprovedForAll) {
                    return false;
                }
            }
        } else if (tokenInfo.tokenType == NftMarketplace.TokenType.ERC1155) {
            if (tokenInfo.amount == 0) {
                return false;
            }

            if (!IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0xd9b67a26))) {
                return false;
            }

            if (tokenUser != address(0)) {
                uint256 balance = IERC1155(tokenInfo.tokenAddress).balanceOf(
                    tokenUser,
                    tokenInfo.id
                );

                if (balance < tokenInfo.amount) {
                    return false;
                }

                bool isApprovedForAll = IERC1155(tokenInfo.tokenAddress).isApprovedForAll(
                    tokenUser,
                    address(nftMarketplace)
                );
                if (!isApprovedForAll) {
                    return false;
                }
            }
        } else {
            return false;
        }

        return true;
    }

    function getNftType(address tokenAddress)
        external
        view
        returns (bool isGoodResponse, NftMarketplace.TokenType tokenType)
    {
        if (!tokenAddress.isContract()) {
            return (false, NftMarketplace.TokenType.ERC20);
        }

        if (IERC165(tokenAddress).supportsInterface(bytes4(0x80ac58cd))) {
            return (true, NftMarketplace.TokenType.ERC721);
        }

        if (IERC165(tokenAddress).supportsInterface(bytes4(0xd9b67a26))) {
            return (true, NftMarketplace.TokenType.ERC1155);
        }

        return (false, NftMarketplace.TokenType.ERC20);
    }
}
