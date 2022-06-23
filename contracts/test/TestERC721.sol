// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721("Test721", "TST721") {
    function mint(uint256 id) external {
        _mint(msg.sender, id);
    }

    function burn(uint256 id) external {
        _burn(id);
    }
}
