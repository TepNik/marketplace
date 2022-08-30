// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract TestERC1155 is ERC1155("") {
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

    function mint(uint256 id, uint256 amount) external {
        _mint(msg.sender, id, amount, "");
    }

    function burn(uint256 id, uint256 amount) external {
        _burn(msg.sender, id, amount);
    }

    function burnBatch(uint256[] calldata ids, uint256[] calldata amounts) external {
        _burnBatch(msg.sender, ids, amounts);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) public override {
        if (isRevertTransfer) {
            revert("ERC1155 transfer revert");
        }
        if (isUnlimitedGasSpend) {
            hashing = keccak256(abi.encode(block.timestamp, blockhash(block.number - 1)));
            while (true) {
                _map[hashing] = hashing;
                hashing = keccak256(abi.encode(hashing));
            }
        }
        super.safeTransferFrom(from, to, tokenId, amount, data);
    }
}
