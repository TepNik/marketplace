// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./TestERC721.sol";

contract TestERC721Ownable is TestERC721, Ownable {}
