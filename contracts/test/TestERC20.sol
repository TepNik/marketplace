// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20("Test20", "TST20") {
    bool public isRevertTransfer;
    bool public isUnlimitedGasSpend;
    bool public isReturnTransferFalse;

    mapping(bytes32 => bytes32) private _map;
    bytes32 private hashing;

    function revertTransfers() external {
        isRevertTransfer = !isRevertTransfer;
    }

    function unlimitedGasSpend() external {
        isUnlimitedGasSpend = !isUnlimitedGasSpend;
    }

    function returnTransferFalse() external {
        isReturnTransferFalse = !isReturnTransferFalse;
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (isRevertTransfer) {
            revert("ERC20 transferFrom revert");
        }
        if (isUnlimitedGasSpend) {
            hashing = keccak256(abi.encode(block.timestamp, blockhash(block.number - 1)));
            while (true) {
                _map[hashing] = hashing;
                hashing = keccak256(abi.encode(hashing));
            }
        }
        if (isReturnTransferFalse) {
            return false;
        }
        return super.transferFrom(from, to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (isRevertTransfer) {
            revert("ERC20 transfer revert");
        }
        if (isUnlimitedGasSpend) {
            hashing = keccak256(abi.encode(block.timestamp, blockhash(block.number - 1)));
            while (true) {
                _map[hashing] = hashing;
                hashing = keccak256(abi.encode(hashing));
            }
        }
        if (isReturnTransferFalse) {
            return false;
        }
        return super.transfer(to, amount);
    }
}
