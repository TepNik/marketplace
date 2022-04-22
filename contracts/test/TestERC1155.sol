// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract TestERC1155 is ERC1155("") {
    function mint(uint256 id, uint256 amount) external {
        _mint(msg.sender, id, amount, "");
    }

    function burn(uint256 id, uint256 amount) external {
        _burn(msg.sender, id, amount);
    }

    function burnBatch(uint256[] calldata ids, uint256[] calldata amounts) external {
        _burnBatch(msg.sender, ids, amounts);
    }
}
