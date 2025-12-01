// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VulnerableContract
 * @notice A deliberately vulnerable contract for testing reentrancy attacks
 * @dev This contract is intentionally insecure for testing purposes only
 */
contract VulnerableContract {
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    /**
     * @notice Deposit Ether into the contract
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some ether");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw funds - VULNERABLE to reentrancy
     * @dev This function is intentionally vulnerable for testing
     */
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // VULNERABILITY: External call before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        // State update after external call - vulnerable to reentrancy
        balances[msg.sender] -= amount;

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Get the balance of an address
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get contract's total balance
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Fallback function to receive ether
     */
    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
}
