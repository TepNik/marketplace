// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract EIP712 {
    using ECDSA for bytes32;
    using ECDSA for bytes;

    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

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
        address sellerAddress;
        bool isTokenToGetMulti;
        bool isTokenToGiveMulti;
        TokenInfo tokenToGet;
        TokenInfo tokenToGive;
        uint256 closeDate;
    }

    bytes32 private constant EIP712DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    bytes32 private constant TOKEN_INFO_TYPEHASH =
        keccak256("TokenInfo(uint8 tokenType,address tokenAddress,uint256 id,uint256 amount)");

    bytes32 private constant SIGNATURE_INFO_TYPEHASH =
        keccak256(
            "SignatureInfo(address sellerAddress,bool isTokenToGetMulti,bool isTokenToGiveMulti,TokenInfo tokenToGet,TokenInfo tokenToGive,uint256 closeDate)TokenInfo(uint8 tokenType,address tokenAddress,uint256 id,uint256 amount)"
        );

    bytes32 private immutable DOMAIN_SEPARATOR;

    constructor() {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = _hash(
            EIP712Domain({
                name: "Nft Marketplace",
                version: "1",
                chainId: chainId,
                verifyingContract: address(this)
            })
        );
    }

    function _hash(EIP712Domain memory eip712Domain) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712DOMAIN_TYPEHASH,
                    keccak256(bytes(eip712Domain.name)),
                    keccak256(bytes(eip712Domain.version)),
                    eip712Domain.chainId,
                    eip712Domain.verifyingContract
                )
            );
    }

    function _hash(TokenInfo memory tokenInfo) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    TOKEN_INFO_TYPEHASH,
                    uint8(tokenInfo.tokenType),
                    tokenInfo.tokenAddress,
                    tokenInfo.id,
                    tokenInfo.amount
                )
            );
    }

    function _hash(SignatureInfo memory signatureInfo) private pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    SIGNATURE_INFO_TYPEHASH,
                    signatureInfo.sellerAddress,
                    signatureInfo.isTokenToGetMulti,
                    signatureInfo.isTokenToGiveMulti,
                    _hash(signatureInfo.tokenToGet),
                    _hash(signatureInfo.tokenToGive),
                    signatureInfo.closeDate
                )
            );
    }

    function _verifySignature(
        SignatureInfo memory signatureInfoSeller,
        bytes calldata sellerSignature,
        address sellerAddress
    ) internal view returns (bytes32 orderId) {
        require(block.timestamp <= signatureInfoSeller.closeDate, "NftMarketplace: Deadline error");
        require(
            signatureInfoSeller.sellerAddress == sellerAddress,
            "NftMarketplace: Wrong user in signature info"
        );

        if (signatureInfoSeller.tokenToGet.tokenType != TokenType.ERC721) {
            require(
                signatureInfoSeller.isTokenToGetMulti == false,
                "NftMarketplace: Only ERC721 can be multi"
            );
        } else if (signatureInfoSeller.isTokenToGetMulti) {
            signatureInfoSeller.tokenToGet.id = 0;
        }

        if (signatureInfoSeller.tokenToGive.tokenType != TokenType.ERC721) {
            require(
                signatureInfoSeller.isTokenToGiveMulti == false,
                "NftMarketplace: Only ERC721 can be multi"
            );
        } else if (signatureInfoSeller.isTokenToGiveMulti) {
            signatureInfoSeller.tokenToGive.id = 0;
        }

        orderId = keccak256(abi.encode(signatureInfoSeller));

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, _hash(signatureInfoSeller))
        );
        require(
            digest.recover(sellerSignature) == sellerAddress,
            "NftMarketplace: Wrong signature"
        );
    }
}
