// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract NftMarketplace is AccessControlEnumerable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using ECDSA for bytes;

    mapping(bytes32 => bool) public isOrderComplited;

    uint256 public feePercentage = 250; // 2.5%
    address public feeReceiver;

    bool public isPaused;

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

    struct SignatureInfo {
        address marketplaceAddress;
        TokenInfo tokenToGet;
        TokenInfo tokenToGive;
        uint256 deadline;
        bytes32 orderId;
    }

    event SwapMade(SignatureInfo signatureInfo, address indexed seller, address indexed buyer);

    event FeePercentageChange(address indexed manager, uint256 oldValue, uint256 newValue);
    event FeeReceiverChange(address indexed manager, address oldValue, address newValue);

    event SwapsPaused(address indexed manager);
    event SwapsUnpaused(address indexed manager);

    constructor(address _feeReceiver) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        require(_feeReceiver != address(0), "NftMarketplace: Zero address");
        feeReceiver = _feeReceiver;

        emit FeePercentageChange(msg.sender, 0, feePercentage);
        emit FeeReceiverChange(msg.sender, address(0), _feeReceiver);
    }

    function setFeePercentage(uint256 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue <= 1_000, "NftMarketplace: Too big percentage"); // 10% max

        uint256 oldValue = feePercentage;
        require(oldValue != newValue, "NftMarketplace: No change");
        feePercentage = newValue;

        emit FeePercentageChange(msg.sender, oldValue, newValue);
    }

    function setFeeReceiver(address newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue != address(0), "NftMarketplace: Zero address");

        address oldValue = feeReceiver;
        require(oldValue != newValue, "NftMarketplace: No change");
        feeReceiver = newValue;

        emit FeeReceiverChange(msg.sender, oldValue, newValue);
    }

    function togglePause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        bool oldValue = isPaused;
        isPaused = !oldValue;

        if (oldValue) {
            emit SwapsPaused(msg.sender);
        } else {
            emit SwapsUnpaused(msg.sender);
        }
    }

    function makeSwap(
        SignatureInfo calldata signatureInfoSeller,
        bytes calldata sellerSignature,
        address sellerAddress
    ) external {
        require(!isPaused, "NftMarketplace: Swaps paused");

        _verifySignature(signatureInfoSeller, sellerSignature, sellerAddress);

        _verifyToken(signatureInfoSeller.tokenToGet);
        _verifyToken(signatureInfoSeller.tokenToGive);

        // One must be ERC20, other NFT
        require(
            (signatureInfoSeller.tokenToGet.tokenType == TokenType.ERC20 ||
                signatureInfoSeller.tokenToGive.tokenType == TokenType.ERC20) &&
                (signatureInfoSeller.tokenToGet.tokenType == TokenType.ERC721 ||
                    signatureInfoSeller.tokenToGet.tokenType == TokenType.ERC1155 ||
                    signatureInfoSeller.tokenToGive.tokenType == TokenType.ERC721 ||
                    signatureInfoSeller.tokenToGive.tokenType == TokenType.ERC1155),
            "NftMarketplace: Wrong tokens type"
        );

        require(!isOrderComplited[signatureInfoSeller.orderId], "NftMarketplace: No double orders");
        isOrderComplited[signatureInfoSeller.orderId] = true;

        _tokenTransfer(signatureInfoSeller.tokenToGive, sellerAddress, msg.sender);
        _tokenTransfer(signatureInfoSeller.tokenToGet, msg.sender, sellerAddress);

        emit SwapMade(signatureInfoSeller, sellerAddress, msg.sender);
    }

    function _verifySignature(
        SignatureInfo memory signatureInfoSeller,
        bytes calldata sellerSignature,
        address sellerAddress
    ) private view {
        require(
            signatureInfoSeller.marketplaceAddress == address(this),
            "NftMarketplace: Wrong marketplace"
        );
        require(block.timestamp <= signatureInfoSeller.deadline, "NftMarketplace: Deadline error");
        bytes memory encodedData = abi.encode(signatureInfoSeller);
        require(
            encodedData.toEthSignedMessageHash().recover(sellerSignature) == sellerAddress,
            "NftMarketplace: Wrong signature"
        );
    }

    function _verifyToken(TokenInfo calldata tokenInfo) private view {
        if (tokenInfo.tokenType == TokenType.ERC20) {
            require(tokenInfo.id == 0, "NftMarketplaceL: ERC20 amount");
            require(tokenInfo.amount > 0, "NftMarketplaceL: ERC20 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC721) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0x80ac58cd)),
                "NftMarketplace: ERC721 type"
            );
            require(tokenInfo.amount == 0, "NftMarketplaceL: ERC721 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC1155) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0xd9b67a26)),
                "NftMarketplace: ERC1155 type"
            );
            require(tokenInfo.amount > 0, "NftMarketplaceL: ERC1155 amount");
        } else {
            revert("NftMarketplace: Type error");
        }
    }

    function _tokenTransfer(
        TokenInfo calldata tokenInfo,
        address from,
        address to
    ) private {
        if (tokenInfo.tokenType == TokenType.ERC20) {
            uint256 feeAmount = (tokenInfo.amount * feePercentage) / 10_000;
            if (from == address(this)) {
                IERC20(tokenInfo.tokenAddress).safeTransfer(to, tokenInfo.amount - feeAmount);

                if (feeAmount > 0) {
                    IERC20(tokenInfo.tokenAddress).safeTransfer(feeReceiver, feeAmount);
                }
            } else {
                IERC20(tokenInfo.tokenAddress).safeTransferFrom(
                    from,
                    to,
                    tokenInfo.amount - feeAmount
                );

                if (feeAmount > 0) {
                    IERC20(tokenInfo.tokenAddress).safeTransferFrom(from, feeReceiver, feeAmount);
                }
            }
        } else if (tokenInfo.tokenType == TokenType.ERC721) {
            IERC721(tokenInfo.tokenAddress).safeTransferFrom(from, to, tokenInfo.id);
        } else if (tokenInfo.tokenType == TokenType.ERC1155) {
            IERC1155(tokenInfo.tokenAddress).safeTransferFrom(
                from,
                to,
                tokenInfo.id,
                tokenInfo.amount,
                ""
            );
        } else {
            revert("NftMarketplace: Type error");
        }
    }
}
