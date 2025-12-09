# Access Control Detection Methodology

## Overview

Access control vulnerabilities occur when functions can be called by unauthorized users, roles are misconfigured, or privilege escalation is possible.

## Vulnerability Categories

### 1. Missing Access Control

**Pattern:**
```solidity
// Vulnerable: No modifier
function withdraw(uint256 amount) external {
    payable(msg.sender).transfer(amount);
}

// Should be:
function withdraw(uint256 amount) external onlyOwner {
    payable(msg.sender).transfer(amount);
}
```

### 2. Incorrect Modifier Usage

**Pattern:**
```solidity
modifier onlyAdmin() {
    require(msg.sender == admin, "Not admin");
    _; // Underscore placement matters!
}

// Vulnerable: Logic after underscore runs regardless
modifier broken() {
    _;
    require(msg.sender == admin); // This executes AFTER function body
}
```

### 3. tx.origin Authentication

**Pattern:**
```solidity
// Vulnerable: tx.origin can be spoofed via phishing
function withdraw() external {
    require(tx.origin == owner, "Not owner");
    // Attacker tricks owner into calling their contract
    // which then calls this function
}

// Safe: Use msg.sender
function withdraw() external {
    require(msg.sender == owner, "Not owner");
}
```

### 4. Unprotected Initializers

**Pattern:**
```solidity
// Vulnerable proxy pattern
contract Proxy {
    address public implementation;

    // Missing access control - anyone can reinitialize
    function initialize(address _impl) external {
        implementation = _impl;
    }
}

// Should use initializer pattern
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SafeProxy is Initializable {
    function initialize(address _impl) external initializer {
        implementation = _impl;
    }
}
```

### 5. Role-Based Access Control (RBAC) Issues

**Pattern:**
```solidity
// Vulnerable: Anyone can grant roles
function grantRole(bytes32 role, address account) external {
    roles[role][account] = true;
}

// Safe: Only admin can grant roles
function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _grantRole(role, account);
}
```

### 6. Centralization Risks

**Pattern:**
```solidity
// Vulnerable: Single point of failure
address public owner;

function pause() external onlyOwner {
    _pause();
}

function changeOwner(address newOwner) external onlyOwner {
    owner = newOwner; // Owner can rug pull
}

// Better: Use multi-sig or timelock
```

## Detection Algorithm

### Step 1: Identify Critical Functions
Functions that:
- Transfer funds
- Change ownership
- Pause/unpause
- Upgrade contracts
- Mint tokens
- Grant permissions
- Modify critical parameters

### Step 2: Check Access Control
For each critical function:
- Is there a modifier (onlyOwner, onlyRole)?
- Is the modifier correctly implemented?
- Does it use msg.sender (not tx.origin)?
- Is there a way to bypass the check?

### Step 3: Analyze Role Hierarchy
- Who can grant roles?
- Can roles be revoked?
- Are there role cascades (admin of admins)?
- Default admin role protected?

### Step 4: Check Initialization
- Is initialize() called in constructor or separately?
- Is it protected against re-initialization?
- Are all state variables properly initialized?

## Chain-of-Thought Template

```json
{
  "step": "Analyzing withdraw() function access control",
  "observation": "Line 34: function withdraw() external - no access control modifier present",
  "hypothesis": "Missing access control allows anyone to withdraw funds",
  "validation": [
    "No onlyOwner or similar modifier",
    "No msg.sender check in function body",
    "Function is external and publicly callable",
    "Transfers contract balance to caller"
  ],
  "conclusion": "CRITICAL: Missing access control on withdraw() enables fund theft",
  "confidence": 0.99
}
```

## Test Generation

### Foundry Test
```solidity
contract AccessControlTest is Test {
    VulnerableContract public target;
    address public owner;
    address public attacker;

    function setUp() public {
        owner = address(1);
        attacker = address(2);

        vm.prank(owner);
        target = new VulnerableContract();

        vm.deal(address(target), 10 ether);
    }

    function testUnauthorizedWithdraw() public {
        uint256 attackerBalanceBefore = attacker.balance;

        // Attacker (not owner) attempts withdrawal
        vm.prank(attacker);
        target.withdraw(5 ether);

        // Should fail, but doesn't due to missing access control
        assertGt(attacker.balance, attackerBalanceBefore);
        console.log("Attacker successfully stole:", attacker.balance);
    }

    function testOwnershipTakeover() public {
        // Attacker attempts to become owner
        vm.prank(attacker);

        vm.expectRevert(); // This should revert
        target.transferOwnership(attacker);

        // If it doesn't revert, critical vulnerability
        if (target.owner() == attacker) {
            console.log("CRITICAL: Ownership takeover successful");
        }
    }
}
```

## Remediation Patterns

### 1. OpenZeppelin Ownable
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract Safe is Ownable {
    function withdraw() external onlyOwner {
        // Protected function
    }
}
```

### 2. Role-Based Access Control
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Safe is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function sensitiveFunction() external onlyRole(ADMIN_ROLE) {
        // Protected
    }
}
```

### 3. Multi-Sig Requirement
```solidity
contract Safe {
    mapping(bytes32 => uint256) public confirmations;
    uint256 public constant REQUIRED_CONFIRMATIONS = 2;

    function executeWithMultiSig(bytes32 txHash) external {
        require(confirmations[txHash] >= REQUIRED_CONFIRMATIONS, "Insufficient confirmations");
        // Execute
    }
}
```

## Historical Examples

- **Parity Wallet Freeze (2017)**: Unprotected initializer led to $300M freeze
- **Poly Network Hack (2021)**: Access control bypass, $600M stolen
- **Wormhole Bridge (2022)**: Missing signature verification, $325M stolen

## References

- SWC-105: Unprotected Ether Withdrawal
- SWC-115: Authorization through tx.origin
- [OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/4.x/access-control)
