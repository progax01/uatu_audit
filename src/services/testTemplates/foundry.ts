/**
 * Foundry test templates for common vulnerabilities
 */

export const FOUNDRY_REENTRANCY_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Reentrancy Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates a reentrancy vulnerability where an attacker
 * can recursively call back into the contract before the first invocation completes.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;
    AttackerContract attacker;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();
        attacker = new AttackerContract(address(target));

        {{SETUP_CODE}}
    }

    function testReentrancyVulnerability() public {
        // Initial setup
        vm.deal(address(target), 10 ether);
        vm.deal(address(attacker), 1 ether);

        // Record balance before attack
        uint256 balanceBefore = address(target).balance;

        // Execute reentrant attack
        // This should either:
        // 1. Revert with "ReentrancyGuard: reentrant call" if protected
        // 2. Succeed and drain funds if vulnerable
        attacker.attack{value: 1 ether}();

        uint256 balanceAfter = address(target).balance;

        // If balance decreased significantly, vulnerability exists
        if (balanceAfter < balanceBefore / 2) {
            emit log_string("VULNERABLE: Reentrancy attack succeeded");
            emit log_named_uint("Drained", balanceBefore - balanceAfter);
        }

        // Test SHOULD FAIL if reentrancy guard is missing
        assertGt(balanceAfter, balanceBefore / 2, "Reentrancy vulnerability: funds drained");
    }
}

contract AttackerContract {
    {{CONTRACT_NAME}} target;
    uint256 public attackCount;

    constructor(address _target) {
        target = {{CONTRACT_NAME}}(_target);
    }

    function attack() external payable {
        // Initiate attack
        {{ATTACK_CODE}}
    }

    // Reentrant callback
    receive() external payable {
        attackCount++;

        // Limit reentrancy depth to prevent gas exhaustion
        if (attackCount < 3 && address(target).balance > 0) {
            {{REENTRANT_CALL}}
        }
    }
}
`;

export const FOUNDRY_ACCESS_CONTROL_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Access Control Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates missing or improper access control that allows
 * unauthorized users to execute privileged functions.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;

    address owner;
    address attacker;

    function setUp() public {
        owner = address(this);
        attacker = address(0xBEEF);

        target = new {{CONTRACT_NAME}}();

        {{SETUP_CODE}}
    }

    function testUnauthorizedAccess() public {
        // Attempt to call privileged function as unauthorized user
        vm.startPrank(attacker);

        // This should revert if access control is properly implemented
        // If it succeeds, the vulnerability exists
        {{VULNERABLE_FUNCTION_CALL}}

        vm.stopPrank();

        // Test SHOULD FAIL if access control is missing
        // The function call above should have reverted
        fail("Access control missing: unauthorized user executed privileged function");
    }

    function testAuthorizedAccess() public {
        // Verify owner can still execute the function
        vm.startPrank(owner);

        {{AUTHORIZED_FUNCTION_CALL}}

        vm.stopPrank();

        // This should always succeed
    }
}
`;

export const FOUNDRY_ARITHMETIC_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Arithmetic Overflow/Underflow Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates arithmetic operations that can overflow or underflow,
 * potentially leading to incorrect calculations or exploits.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();

        {{SETUP_CODE}}
    }

    function testArithmeticOverflow() public {
        // Set up values that will cause overflow
        {{OVERFLOW_SETUP}}

        // Execute vulnerable function
        // Should revert with overflow error if protected (Solidity 0.8+)
        // Will wrap around silently if vulnerable (Solidity <0.8 or unchecked)
        {{VULNERABLE_FUNCTION_CALL}}

        // Verify result
        {{RESULT_VERIFICATION}}

        // Test SHOULD FAIL if overflow is not properly handled
        fail("Arithmetic overflow not protected");
    }

    function testArithmeticUnderflow() public {
        // Set up values that will cause underflow
        {{UNDERFLOW_SETUP}}

        // Execute vulnerable function
        {{VULNERABLE_FUNCTION_CALL}}

        // Verify result
        {{RESULT_VERIFICATION}}

        // Test SHOULD FAIL if underflow is not properly handled
        fail("Arithmetic underflow not protected");
    }
}
`;

export const FOUNDRY_FLASH_LOAN_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Flash Loan Attack Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates how flash loans can be used to manipulate
 * contract state or exploit vulnerabilities.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;
    FlashLoanAttacker attacker;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();
        attacker = new FlashLoanAttacker(address(target));

        {{SETUP_CODE}}
    }

    function testFlashLoanAttack() public {
        // Record initial state
        {{RECORD_INITIAL_STATE}}

        // Simulate flash loan using Foundry's deal()
        uint256 flashLoanAmount = 1000000 ether;
        deal(address(attacker), flashLoanAmount);

        // Execute attack
        attacker.executeAttack(flashLoanAmount);

        // Verify attack succeeded
        {{VERIFY_ATTACK_RESULT}}

        // Test SHOULD FAIL if flash loan attack succeeds
        fail("Flash loan attack succeeded - contract is vulnerable");
    }
}

contract FlashLoanAttacker {
    {{CONTRACT_NAME}} target;

    constructor(address _target) {
        target = {{CONTRACT_NAME}}(_target);
    }

    function executeAttack(uint256 flashLoanAmount) external {
        // 1. Receive flash loan (simulated)

        // 2. Execute attack using borrowed funds
        {{ATTACK_LOGIC}}

        // 3. Repay flash loan
        // (In real scenario, would need to repay + fee)

        // 4. Profit from attack
    }
}
`;

export const FOUNDRY_PRICE_MANIPULATION_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Price Manipulation Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates how price feeds or oracles can be manipulated
 * to exploit the contract.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();

        {{SETUP_CODE}}
    }

    function testPriceManipulation() public {
        // Record price before manipulation
        {{RECORD_INITIAL_PRICE}}

        // Manipulate price through large trade or oracle update
        {{PRICE_MANIPULATION_CODE}}

        // Verify price changed significantly
        {{VERIFY_PRICE_CHANGE}}

        // Execute vulnerable function with manipulated price
        {{VULNERABLE_FUNCTION_CALL}}

        // Check if attacker profited from manipulation
        {{VERIFY_PROFIT}}

        // Test SHOULD FAIL if price manipulation attack succeeds
        fail("Price manipulation attack succeeded");
    }
}
`;

export const FOUNDRY_UNCHECKED_RETURN_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Unchecked Return Value Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates missing checks on return values from external calls,
 * which can lead to silent failures.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;
    FailingContract failingContract;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();
        failingContract = new FailingContract();

        {{SETUP_CODE}}
    }

    function testUncheckedReturnValue() public {
        // Call function that doesn't check return value
        // The external call will fail, but the transaction continues
        {{VULNERABLE_FUNCTION_CALL}}

        // Verify that the transaction succeeded despite the failure
        // This demonstrates the unchecked return value vulnerability

        // Test SHOULD FAIL if return value is not checked
        fail("Unchecked return value: function succeeded despite external call failure");
    }
}

contract FailingContract {
    // This contract's calls will fail, testing if return values are checked
    function transfer(address to, uint256 amount) external returns (bool) {
        return false; // Always fails
    }
}
`;

export const FOUNDRY_TIMESTAMP_DEPENDENCE_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Timestamp Dependence Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates vulnerabilities related to block.timestamp manipulation
 * or dependence on timestamps for critical logic.
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();

        {{SETUP_CODE}}
    }

    function testTimestampManipulation() public {
        // Set initial timestamp
        vm.warp(1000000);

        // Execute function at timestamp T
        {{EXECUTE_AT_TIME_T}}

        // Manipulate timestamp to future/past
        vm.warp({{MANIPULATED_TIME}});

        // Execute same function at manipulated timestamp
        {{EXECUTE_AT_MANIPULATED_TIME}}

        // Verify that timestamp manipulation led to different/exploitable behavior
        {{VERIFY_MANIPULATION_IMPACT}}

        // Test SHOULD FAIL if timestamp dependence allows manipulation
        fail("Timestamp manipulation succeeded - logic depends on block.timestamp");
    }
}
`;

export const FOUNDRY_GENERIC_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/{{CONTRACT_NAME}}.sol";

/**
 * Security Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * Description: {{FINDING_DESCRIPTION}}
 */
contract {{TEST_NAME}} is Test {
    {{CONTRACT_NAME}} target;

    function setUp() public {
        target = new {{CONTRACT_NAME}}();

        {{SETUP_CODE}}
    }

    function testVulnerability() public {
        // Set up test conditions
        {{TEST_SETUP}}

        // Execute vulnerable code path
        {{VULNERABLE_CODE_EXECUTION}}

        // Verify vulnerability exists
        {{VULNERABILITY_VERIFICATION}}

        // Test SHOULD FAIL if vulnerability exists
        fail("Vulnerability demonstrated: {{FINDING_TITLE}}");
    }
}
`;

/**
 * Get template by vulnerability type
 */
export function getFoundryTemplate(vulnerabilityType: string): string {
  const templates: Record<string, string> = {
    reentrancy: FOUNDRY_REENTRANCY_TEMPLATE,
    access_control: FOUNDRY_ACCESS_CONTROL_TEMPLATE,
    arithmetic: FOUNDRY_ARITHMETIC_TEMPLATE,
    flash_loan: FOUNDRY_FLASH_LOAN_TEMPLATE,
    price_manipulation: FOUNDRY_PRICE_MANIPULATION_TEMPLATE,
    unchecked_return: FOUNDRY_UNCHECKED_RETURN_TEMPLATE,
    timestamp_dependence: FOUNDRY_TIMESTAMP_DEPENDENCE_TEMPLATE,
    generic: FOUNDRY_GENERIC_TEMPLATE,
  };

  return templates[vulnerabilityType] || FOUNDRY_GENERIC_TEMPLATE;
}
