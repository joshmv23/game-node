// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VirtualsToken is ERC20Votes, Ownable {
    constructor(
        address initialOwner
    ) ERC20("Virtuals Token", "VIRT") ERC20Permit("Virtuals Token") {
        _mint(initialOwner, 1000000 * 10 ** decimals()); // Mint 1M tokens to owner
        _transferOwnership(initialOwner);
    }

    // The following functions are overrides required by Solidity
    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal virtual override {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal virtual override {
        super._burn(account, amount);
    }

    function nonces(address owner) public view virtual override returns (uint256) {
        return super.nonces(owner);
    }

    function delegate(address delegatee) public override {
        require(delegatee != address(0), "Cannot delegate to zero address");
        _delegate(_msgSender(), delegatee);
    }
} 