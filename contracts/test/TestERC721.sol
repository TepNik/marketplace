// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721("Test721", "TST721") {
    bool public isRevertTransfer;
    bool public isUnlimitedGasSpend;

    mapping(bytes32 => bytes32) private _map;
    bytes32 private hashing;

    function revertTransfers() external {
        isRevertTransfer = !isRevertTransfer;
    }

    function unlimitedGasSpend() external {
        isUnlimitedGasSpend = !isUnlimitedGasSpend;
    }

    function mint(uint256 id) external {
        _mint(msg.sender, id);
    }

    function burn(uint256 id) external {
        _burn(id);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        if (isRevertTransfer) {
            revert("ERC721 transfer revert");
        }
        if (isUnlimitedGasSpend) {
            hashing = keccak256(abi.encode(block.timestamp, blockhash(block.number - 1)));
            while (true) {
                _map[hashing] = hashing;
                hashing = keccak256(abi.encode(hashing));
            }
        }
        super.safeTransferFrom(from, to, tokenId);
    }
}
