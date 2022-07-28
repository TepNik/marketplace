// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./RoyaltiesInfo.sol";
import "./EIP712.sol";

contract NftMarketplace is RoyaltiesInfo, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using ECDSA for bytes;
    using Address for address;

    /// @notice Holds information about whether an order is completed or not.
    mapping(bytes32 => bool) public isOrderCompleted;

    /// @notice Address of the WNative ERC20 token.
    address public immutable wNative;

    /// @notice Fee percentage of the marketplace (denominator 10000). Max value is 1000 (10%).
    uint256 public feePercentage = 2_50; // 2.5%
    /// @notice Address that will receive all marketplace fees.
    address public feeReceiver;

    /// @notice Shows if the marketplace is paused by an admin.
    bool public isPaused;

    uint256 private constant MAX_GAS_FOR_NATIVE_TRANSFER = 200_000;

    /// @notice Event is emitted when an order is completed.
    /// @param signatureInfo Info about an order. More info about this structure can be found in makeSwap() function.
    /// @param seller Address that sold their tokens.
    /// @param buyer This address signed the swap transaction.
    /// @param orderId Unique identifier for this order.
    event SwapMade(
        SignatureInfo signatureInfo,
        address indexed seller,
        address indexed buyer,
        bytes32 orderId
    );

    /// @notice Event is emitted when fees of the marketplace were transferred.
    /// @param feeReceiver Address that received fees.
    /// @param token Address of a token that was transfered.
    /// @param amount Fee amount.
    event FeeTransferred(address indexed feeReceiver, address indexed token, uint256 amount);

    /// @notice Event is emitted when royalties were transferred.
    /// @param royaltyReceiver Address that received royalties.
    /// @param token Address of a token that was transfered.
    /// @param amount Royalty amount.
    event RoyaltyTransferred(
        address indexed royaltyReceiver,
        address indexed token,
        uint256 amount
    );

    /// @notice Event is emitted when an admin (`manager`) has set new fee percentages for the marketplace.
    /// @param manager Address of the admin that has changed fee percentages for the marketplace.
    /// @param oldValue Previous value of fee percentages for the marketplace.
    /// @param newValue New value of fee percentages for the marketplace.
    event FeePercentageChange(address indexed manager, uint256 oldValue, uint256 newValue);
    /// @notice Event is emitted when an admin (`manager`) has set new fee receiver for the marketplace.
    /// @param manager Address of an admin that has changed fee receiver for the marketplace.
    /// @param oldValue Previous fee receiver of the marketplace.
    /// @param newValue New fee receiver of the marketplace.
    event FeeReceiverChange(
        address indexed manager,
        address indexed oldValue,
        address indexed newValue
    );

    /// @notice Event is emitted when an admin (`manager`) has paused the marketplace.
    /// @param manager Address of an admin that has paused the marketplace.
    event SwapsPaused(address indexed manager);
    /// @notice Event is emitted when an admin (`manager`) has unpaused the marketplace.
    /// @param manager Address of an admin that has unpaused the marketplace.
    event SwapsUnpaused(address indexed manager);

    /// @notice Constructor of the marketplace.
    /// @param _feeReceiver Address of a fee receiver of the marketplace.
    /// @param _wnative Address of the WNative ERC20 token.
    constructor(address _feeReceiver, address _wnative) {
        require(_feeReceiver != address(0), "NftMarketplace: Zero address");
        feeReceiver = _feeReceiver;

        wNative = _wnative;

        emit FeePercentageChange(msg.sender, 0, feePercentage);
        emit FeeReceiverChange(msg.sender, address(0), _feeReceiver);
    }

    /// @notice Admin funciton for setting new value for fee percentages of the marketplace.
    /// @param newValue New value of the marketplace fee percentages.
    function setFeePercentage(uint256 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue <= 10_00, "NftMarketplace: Too big percentage"); // 10% max

        uint256 oldValue = feePercentage;
        require(oldValue != newValue, "NftMarketplace: No change");
        feePercentage = newValue;

        emit FeePercentageChange(msg.sender, oldValue, newValue);
    }

    /// @notice Admin function for setting new value for the marketplace's fee receiver.
    /// @param newValue New value of the marketplace's fee receiver.
    function setFeeReceiver(address newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue != address(0), "NftMarketplace: Zero address");

        address oldValue = feeReceiver;
        require(oldValue != newValue, "NftMarketplace: No change");
        feeReceiver = newValue;

        emit FeeReceiverChange(msg.sender, oldValue, newValue);
    }

    /// @notice Admin function for pausing/unpausing the marketplace.
    function togglePause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        bool oldValue = isPaused;
        isPaused = !oldValue;

        if (oldValue) {
            emit SwapsUnpaused(msg.sender);
        } else {
            emit SwapsPaused(msg.sender);
        }
    }

    /// @notice Function for performing swap and completing an order.
    /// @param sellerSignature Signature of a seller. Signing message has to be the first argument (`signatureInfoSeller`).
    /// @param sellerAddress Address of a seller.
    function makeSwap(
        SignatureInfo calldata signatureInfoSeller,
        bytes calldata sellerSignature,
        address sellerAddress
    ) external payable {
        require(!isPaused, "NftMarketplace: Swaps paused");

        bytes32 orderId = _verifySignature(signatureInfoSeller, sellerSignature, sellerAddress);

        _verifyToken(signatureInfoSeller.tokenToGet);
        _verifyToken(signatureInfoSeller.tokenToGive);

        // One must be ERC20, other NFT
        require(
            (signatureInfoSeller.tokenToGet.tokenType == TokenType.ERC20 ||
                signatureInfoSeller.tokenToGive.tokenType == TokenType.ERC20) &&
                (signatureInfoSeller.tokenToGet.tokenType != TokenType.ERC20 ||
                    signatureInfoSeller.tokenToGive.tokenType != TokenType.ERC20),
            "NftMarketplace: Wrong tokens type"
        );

        require(!isOrderCompleted[orderId], "NftMarketplace: No double orders");
        isOrderCompleted[orderId] = true;

        address nftAddress;
        uint256 tokenId;
        uint256 price;
        if (signatureInfoSeller.tokenToGet.tokenType != TokenType.ERC20) {
            nftAddress = signatureInfoSeller.tokenToGet.tokenAddress;
            tokenId = signatureInfoSeller.tokenToGet.id;
            price = signatureInfoSeller.tokenToGive.amount;
        } else {
            nftAddress = signatureInfoSeller.tokenToGive.tokenAddress;
            tokenId = signatureInfoSeller.tokenToGive.id;
            price = signatureInfoSeller.tokenToGet.amount;
        }
        (address royaltyReceiver, uint256 royaltyAmount) = getRoyaltyInfo(
            nftAddress,
            tokenId,
            price
        );

        _tokenTransfer(
            signatureInfoSeller.tokenToGive,
            sellerAddress,
            msg.sender,
            royaltyReceiver,
            royaltyAmount
        );
        _tokenTransfer(
            signatureInfoSeller.tokenToGet,
            msg.sender,
            sellerAddress,
            royaltyReceiver,
            royaltyAmount
        );

        emit SwapMade(signatureInfoSeller, sellerAddress, msg.sender, orderId);
    }

    function _verifyToken(TokenInfo calldata tokenInfo) private view {
        require(tokenInfo.tokenAddress.isContract(), "NftMarketplace: Not a contract");
        if (tokenInfo.tokenType == TokenType.ERC20) {
            require(tokenInfo.id == 0, "NftMarketplace: ERC20 amount");
            require(tokenInfo.amount > 0, "NftMarketplace: ERC20 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC721) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0x80ac58cd)),
                "NftMarketplace: ERC721 type"
            );
            require(tokenInfo.amount == 0, "NftMarketplace: ERC721 amount");
        } else if (tokenInfo.tokenType == TokenType.ERC1155) {
            require(
                IERC165(tokenInfo.tokenAddress).supportsInterface(bytes4(0xd9b67a26)),
                "NftMarketplace: ERC1155 type"
            );
            require(tokenInfo.amount > 0, "NftMarketplace: ERC1155 amount");
        }
    }

    function _tokenTransfer(
        TokenInfo calldata tokenInfo,
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

            bool ifNative = from == msg.sender && tokenInfo.tokenAddress == wNative;
            if (!ifNative) {
                require(msg.value == 0, "NftMarketplace: Not zero tx value");
            }
            ifNative = ifNative && msg.value > 0;

            if (ifNative) {
                require(msg.value == tokenInfo.amount, "NftMarketplace: Wrong value");
                (bool success, ) = to.call{
                    value: tokenInfo.amount - feeAmount - royaltyAmount,
                    gas: MAX_GAS_FOR_NATIVE_TRANSFER
                }("");
                require(success, "NftMarketplace: Transfer native to seller");
            } else {
                IERC20(tokenInfo.tokenAddress).safeTransferFrom(
                    from,
                    to,
                    tokenInfo.amount - feeAmount - royaltyAmount
                );
            }

            if (feeAmount > 0) {
                address _feeReceiver = feeReceiver;

                if (ifNative) {
                    (bool success, ) = _feeReceiver.call{value: feeAmount}("");
                    require(success, "NftMarketplace: Transfer native to feeReceiver");
                } else {
                    IERC20(tokenInfo.tokenAddress).safeTransferFrom(from, _feeReceiver, feeAmount);
                }

                emit FeeTransferred(_feeReceiver, tokenInfo.tokenAddress, feeAmount);
            }
            if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
                if (ifNative) {
                    (bool success, ) = royaltyReceiver.call{
                        value: royaltyAmount,
                        gas: MAX_GAS_FOR_NATIVE_TRANSFER
                    }("");
                    require(success, "NftMarketplace: Transfer native to royaltyReceiver");
                } else {
                    IERC20(tokenInfo.tokenAddress).safeTransferFrom(
                        from,
                        royaltyReceiver,
                        royaltyAmount
                    );
                }

                emit RoyaltyTransferred(royaltyReceiver, tokenInfo.tokenAddress, royaltyAmount);
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
        }
    }
}
