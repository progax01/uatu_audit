/**
 * Hardhat test templates for common vulnerabilities
 */

export const HARDHAT_REENTRANCY_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Reentrancy Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates a reentrancy vulnerability where an attacker
 * can recursively call back into the contract before the first invocation completes.
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let attacker: Contract;
  let owner: Signer;
  let attackerSigner: Signer;

  beforeEach(async function () {
    [owner, attackerSigner] = await ethers.getSigners();

    // Deploy target contract
    const TargetFactory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await TargetFactory.deploy();
    await target.deployed();

    // Deploy attacker contract
    const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
    attacker = await AttackerFactory.deploy(target.address);
    await attacker.deployed();

    {{SETUP_CODE}}
  });

  it("should demonstrate reentrancy vulnerability", async function () {
    // Fund target contract
    await owner.sendTransaction({
      to: target.address,
      value: ethers.utils.parseEther("10"),
    });

    // Record balance before attack
    const balanceBefore = await ethers.provider.getBalance(target.address);

    // Execute reentrant attack
    // This should either:
    // 1. Revert with "ReentrancyGuard: reentrant call" if protected
    // 2. Succeed and drain funds if vulnerable
    await attacker.attack({ value: ethers.utils.parseEther("1") });

    const balanceAfter = await ethers.provider.getBalance(target.address);
    const drained = balanceBefore.sub(balanceAfter);

    // If balance decreased significantly, vulnerability exists
    if (balanceAfter.lt(balanceBefore.div(2))) {
      console.log("VULNERABLE: Reentrancy attack succeeded");
      console.log("Drained:", ethers.utils.formatEther(drained), "ETH");
    }

    // Test SHOULD FAIL if reentrancy guard is missing
    expect(balanceAfter).to.be.gt(
      balanceBefore.div(2),
      "Reentrancy vulnerability: funds drained"
    );
  });
});

// Attacker contract would be defined separately or inline
`;

export const HARDHAT_ACCESS_CONTROL_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Access Control Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates missing or improper access control that allows
 * unauthorized users to execute privileged functions.
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let owner: Signer;
  let attacker: Signer;

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await Factory.connect(owner).deploy();
    await target.deployed();

    {{SETUP_CODE}}
  });

  it("should prevent unauthorized access", async function () {
    // Attempt to call privileged function as unauthorized user
    // This should revert if access control is properly implemented
    await expect(
      {{VULNERABLE_FUNCTION_CALL}}
    ).to.be.revertedWith("Unauthorized");

    // If we reach here without revert, access control is missing
    expect.fail("Access control missing: unauthorized user executed privileged function");
  });

  it("should allow authorized access", async function () {
    // Verify owner can execute the function
    await expect(
      {{AUTHORIZED_FUNCTION_CALL}}
    ).to.not.be.reverted;
  });
});
`;

export const HARDHAT_ARITHMETIC_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Arithmetic Overflow/Underflow Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * This test demonstrates arithmetic operations that can overflow or underflow.
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await Factory.deploy();
    await target.deployed();

    {{SETUP_CODE}}
  });

  it("should protect against arithmetic overflow", async function () {
    // Set up values that will cause overflow
    {{OVERFLOW_SETUP}}

    // Execute vulnerable function
    // Should revert with overflow error if protected (Solidity 0.8+)
    await expect(
      {{VULNERABLE_FUNCTION_CALL}}
    ).to.be.reverted;

    // If we reach here, overflow was not protected
    expect.fail("Arithmetic overflow not protected");
  });

  it("should protect against arithmetic underflow", async function () {
    // Set up values that will cause underflow
    {{UNDERFLOW_SETUP}}

    // Execute vulnerable function
    await expect(
      {{VULNERABLE_FUNCTION_CALL}}
    ).to.be.reverted;

    // If we reach here, underflow was not protected
    expect.fail("Arithmetic underflow not protected");
  });
});
`;

export const HARDHAT_FLASH_LOAN_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Flash Loan Attack Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let attacker: Contract;
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const TargetFactory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await TargetFactory.deploy();
    await target.deployed();

    const AttackerFactory = await ethers.getContractFactory("FlashLoanAttacker");
    attacker = await AttackerFactory.deploy(target.address);
    await attacker.deployed();

    {{SETUP_CODE}}
  });

  it("should prevent flash loan attacks", async function () {
    // Record initial state
    {{RECORD_INITIAL_STATE}}

    // Fund attacker with large amount (simulating flash loan)
    const flashLoanAmount = ethers.utils.parseEther("1000000");
    await owner.sendTransaction({
      to: attacker.address,
      value: flashLoanAmount,
    });

    // Execute attack
    await attacker.executeAttack(flashLoanAmount);

    // Verify attack result
    {{VERIFY_ATTACK_RESULT}}

    // Test SHOULD FAIL if flash loan attack succeeds
    expect.fail("Flash loan attack succeeded - contract is vulnerable");
  });
});
`;

export const HARDHAT_PRICE_MANIPULATION_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Price Manipulation Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let owner: Signer;
  let attacker: Signer;

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await Factory.deploy();
    await target.deployed();

    {{SETUP_CODE}}
  });

  it("should prevent price manipulation attacks", async function () {
    // Record price before manipulation
    {{RECORD_INITIAL_PRICE}}

    // Manipulate price through large trade
    {{PRICE_MANIPULATION_CODE}}

    // Verify price changed significantly
    {{VERIFY_PRICE_CHANGE}}

    // Execute vulnerable function with manipulated price
    {{VULNERABLE_FUNCTION_CALL}}

    // Check if attacker profited
    {{VERIFY_PROFIT}}

    // Test SHOULD FAIL if price manipulation succeeds
    expect.fail("Price manipulation attack succeeded");
  });
});
`;

export const HARDHAT_UNCHECKED_RETURN_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Unchecked Return Value Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let failingContract: Contract;
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const TargetFactory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await TargetFactory.deploy();
    await target.deployed();

    const FailingFactory = await ethers.getContractFactory("FailingContract");
    failingContract = await FailingFactory.deploy();
    await failingContract.deployed();

    {{SETUP_CODE}}
  });

  it("should check return values from external calls", async function () {
    // Call function that doesn't check return value
    // The external call will fail, but the transaction continues
    await {{VULNERABLE_FUNCTION_CALL}};

    // If we reach here, return value was not checked
    expect.fail("Unchecked return value: function succeeded despite external call failure");
  });
});
`;

export const HARDHAT_TIMESTAMP_DEPENDENCE_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Timestamp Dependence Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await Factory.deploy();
    await target.deployed();

    {{SETUP_CODE}}
  });

  it("should not depend on block.timestamp for critical logic", async function () {
    // Set initial timestamp
    await time.increaseTo(1000000);

    // Execute function at timestamp T
    {{EXECUTE_AT_TIME_T}}

    // Manipulate timestamp
    await time.increaseTo({{MANIPULATED_TIME}});

    // Execute same function at manipulated timestamp
    {{EXECUTE_AT_MANIPULATED_TIME}}

    // Verify manipulation impact
    {{VERIFY_MANIPULATION_IMPACT}}

    // Test SHOULD FAIL if timestamp dependence allows manipulation
    expect.fail("Timestamp manipulation succeeded");
  });
});
`;

export const HARDHAT_GENERIC_TEMPLATE = `import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

/**
 * Security Vulnerability Test
 * Finding: {{FINDING_TITLE}}
 * Severity: {{SEVERITY}}
 *
 * Description: {{FINDING_DESCRIPTION}}
 */
describe("{{TEST_NAME}}", function () {
  let target: Contract;
  let owner: Signer;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("{{CONTRACT_NAME}}");
    target = await Factory.deploy();
    await target.deployed();

    {{SETUP_CODE}}
  });

  it("should demonstrate vulnerability", async function () {
    // Set up test conditions
    {{TEST_SETUP}}

    // Execute vulnerable code path
    {{VULNERABLE_CODE_EXECUTION}}

    // Verify vulnerability exists
    {{VULNERABILITY_VERIFICATION}}

    // Test SHOULD FAIL if vulnerability exists
    expect.fail("Vulnerability demonstrated: {{FINDING_TITLE}}");
  });
});
`;

/**
 * Get template by vulnerability type
 */
export function getHardhatTemplate(vulnerabilityType: string): string {
  const templates: Record<string, string> = {
    reentrancy: HARDHAT_REENTRANCY_TEMPLATE,
    access_control: HARDHAT_ACCESS_CONTROL_TEMPLATE,
    arithmetic: HARDHAT_ARITHMETIC_TEMPLATE,
    flash_loan: HARDHAT_FLASH_LOAN_TEMPLATE,
    price_manipulation: HARDHAT_PRICE_MANIPULATION_TEMPLATE,
    unchecked_return: HARDHAT_UNCHECKED_RETURN_TEMPLATE,
    timestamp_dependence: HARDHAT_TIMESTAMP_DEPENDENCE_TEMPLATE,
    generic: HARDHAT_GENERIC_TEMPLATE,
  };

  return templates[vulnerabilityType] || HARDHAT_GENERIC_TEMPLATE;
}
