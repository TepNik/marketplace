// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract TestERC721Enumerable is ERC721Enumerable {
    constructor() ERC721("Test721", "TST721") {}

    function mint(uint256 id) external {
        _mint(msg.sender, id);
    }

    function burn(uint256 id) external {
        _burn(id);
    }
}
