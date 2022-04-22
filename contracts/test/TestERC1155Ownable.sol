// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./TestERC1155.sol";

contract TestERC1155Ownable is TestERC1155, Ownable {}
