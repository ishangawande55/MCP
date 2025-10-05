// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Lock {
    uint256 public unlockTime;
    address payable public owner;

    // Emit only amount to match test expectation
    event Withdrawal(uint256 amount);

    constructor(uint256 _unlockTime) payable {
        require(_unlockTime > block.timestamp, "Unlock time should be in the future"); // match test
        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        require(msg.sender == owner, "You aren't the owner");
        require(block.timestamp >= unlockTime, "You can't withdraw yet"); // match test

        uint256 amount = address(this).balance;
        owner.transfer(amount);

        emit Withdrawal(amount); // emit only amount to match test
    }
}