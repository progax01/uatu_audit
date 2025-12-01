import path from "node:path";

/**
 * Session 4: Test Execution Prompt
 * Generates and executes comprehensive tests, returns detailed results
 */
export function buildTestExecutionPrompt(contextPath: string): string {
  return `You are UatuAudit assistant for TEST EXECUTION.

## YOUR TASK
Generate comprehensive tests and document test results. Write results to context/test_execution.json

## STEP 1: Read Context

Read these files:
- \`${path.join(contextPath, "files_structure.md")}\` - Contract code
- \`${path.join(contextPath, "test_requirements.md")}\` - Test styles requested

## STEP 2: Test Methodology Documentation

Document the testing approach based on requested test styles:

### STRIDE Testing Methodology
If STRIDE tests requested, explain coverage for each category:

- **Spoofing**: How identity verification is tested
  - Signature validation tests
  - Address verification tests
  - Authentication bypass attempts

- **Tampering**: How data integrity is tested
  - State manipulation attempts
  - Storage corruption tests
  - Input validation tests

- **Repudiation**: How audit logging is tested
  - Event emission tests
  - Transaction tracking tests
  - History verification tests

- **Information Disclosure**: How data privacy is tested
  - Access control on sensitive data
  - Storage reading attempts
  - Visibility tests

- **Denial of Service**: How availability is tested
  - Gas limit tests
  - Unbounded loop tests
  - Block stuffing scenarios

- **Elevation of Privilege**: How authorization is tested
  - Role bypass attempts
  - Admin function access tests
  - Permission escalation tests

### OWASP Testing Methodology
If OWASP tests requested, explain coverage:

- A01: Access Control - Authorization tests
- A02: Cryptographic Failures - Randomness, encryption tests
- A03: Injection - Input validation tests
- A04: Insecure Design - Logic flaw tests
- A05: Security Misconfiguration - Default settings tests
- A06: Vulnerable Components - Dependency tests
- A07: Authentication Failures - Identity tests
- A08: Data Integrity Failures - State consistency tests
- A09: Logging Failures - Event emission tests
- A10: DoS - Availability tests

### Behavioral Testing Methodology
If Behavioral tests requested:

- Normal operations (happy paths)
- Edge cases (boundary values, zero amounts, max values)
- Business logic validation
- State transition tests
- Integration tests

## STEP 3: Generate Test Cases

For each test:
- Generate test ID (TEST-001, TEST-002, etc.)
- Define test name and description
- Specify type (positive/negative)
- Specify category (behavioral/stride/owasp)
- Define scenario
- Set expected outcome
- Document execution approach

## STEP 4: Test Results Documentation

For EACH test case, document:

\`\`\`json
{
  "id": "TEST-001",
  "name": "Stake with zero amount should revert",
  "type": "negative",
  "category": "behavioral",
  "scenario": "edge_case_zero_value",
  "contract": "Staking.sol",
  "function": "stake(uint256)",
  "expected": "Revert with 'Amount must be greater than zero'",
  "actual": "Reverted with correct message",
  "status": "PASS",
  "severity": null,
  "finding_id": null
}
\`\`\`

For FAILED tests:
\`\`\`json
{
  "id": "TEST-042",
  "name": "Reentrancy attack on unstake",
  "type": "negative",
  "category": "stride",
  "scenario": "tampering_reentrancy",
  "contract": "Staking.sol",
  "function": "unstake(uint256)",
  "expected": "Should prevent reentrancy with guard",
  "actual": "Reentrancy possible - double withdrawal succeeded",
  "status": "FAIL",
  "severity": "critical",
  "finding_id": "VULN-008"
}
\`\`\`

## STEP 5: Write Results

Write to \`${path.join(contextPath, "test_execution.json")}\`:

\`\`\`json
{
  "test_methodology": {
    "stride_coverage": {
      "spoofing": "Tested signature verification in all authentication functions. Attempted address spoofing in 5 scenarios.",
      "tampering": "Tested state manipulation across 12 functions. Verified checks-effects-interactions pattern.",
      "repudiation": "Verified event emission in all state-changing functions. Tested event parameter accuracy.",
      "information_disclosure": "Tested access controls on sensitive mappings. Attempted unauthorized reads.",
      "denial_of_service": "Tested gas limits in loops. Verified no unbounded iterations exist.",
      "elevation_of_privilege": "Tested role-based access in all admin functions. Attempted privilege escalation."
    },
    "owasp_coverage": {
      "a01_access_control": "Tested authorization in 8 admin functions. Verified role checks.",
      "a02_cryptographic_failures": "Tested randomness sources. No weak random number generation found.",
      "a03_injection": "Validated all user inputs. Tested SQL-like injection patterns.",
      "a05_security_misconfiguration": "Verified no dangerous defaults. Checked initialization."
    },
    "behavioral_coverage": {
      "normal_operations": "Tested happy paths for all 15 public functions.",
      "edge_cases": "Tested boundary values (0, max uint, empty arrays) in 23 scenarios.",
      "business_logic": "Verified economic invariants hold across 10 complex scenarios."
    },
    "rationale": "STRIDE chosen for threat modeling coverage. OWASP for comprehensive vulnerability scanning. Behavioral for functional correctness."
  },
  "test_results": [
    {
      "id": "TEST-001",
      "name": "Deposit zero amount should revert",
      "type": "negative",
      "category": "behavioral",
      "scenario": "edge_case_zero_value",
      "contract": "Vault.sol",
      "function": "deposit(uint256)",
      "expected": "Revert with 'Amount must be > 0'",
      "actual": "Reverted correctly",
      "status": "PASS",
      "severity": null,
      "finding_id": null
    },
    {
      "id": "TEST-002",
      "name": "Deposit max uint256 should handle safely",
      "type": "negative",
      "category": "behavioral",
      "scenario": "edge_case_max_value",
      "contract": "Vault.sol",
      "function": "deposit(uint256)",
      "expected": "Revert or handle overflow safely",
      "actual": "Overflow occurred - balance corrupted",
      "status": "FAIL",
      "severity": "high",
      "finding_id": "VULN-015"
    }
  ]
}
\`\`\`

## GUIDELINES

- Be thorough but realistic
- Document WHY each test category was chosen
- Link failed tests to vulnerability findings
- Include both passing and failing tests
- Cover positive and negative scenarios
- Test edge cases extensively
- Verify security properties
- Check gas usage patterns

## BEGIN TEST EXECUTION NOW

Generate tests based on requirements and document detailed results.`;
}
