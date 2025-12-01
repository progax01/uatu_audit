// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VulnerableVault
 * @notice A vault contract with multiple security vulnerabilities for testing
 * @dev Contains various intentional vulnerabilities for security testing
 */
contract VulnerableVault {
    mapping(address => uint256) public deposits;
    address public owner;
    bool private locked;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Deposit funds into the vault
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw funds - vulnerable version without reentrancy guard
     */
    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount, "Insufficient balance");

        // VULNERABILITY: State update after external call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        deposits[msg.sender] -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Emergency withdraw - with basic reentrancy protection
     */
    function emergencyWithdraw() external {
        require(!locked, "Reentrant call");
        locked = true;

        uint256 amount = deposits[msg.sender];
        require(amount > 0, "No balance");

        deposits[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit EmergencyWithdraw(msg.sender, amount);
        locked = false;
    }

    /**
     * @notice Get user's deposit balance
     */
    function getDeposit(address user) external view returns (uint256) {
        return deposits[user];
    }

    /**
     * @notice Get vault's total balance
     */
    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Owner can withdraw funds - demonstrates centralization risk
     */
    function ownerWithdraw(uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        require(address(this).balance >= amount, "Insufficient vault balance");

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Transfer ownership - missing access control
     */
    function transferOwnership(address newOwner) external {
        // VULNERABILITY: Missing access control
        owner = newOwner;
    }

    /**
     * @notice Fallback to receive ether
     */
    receive() external payable {
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
