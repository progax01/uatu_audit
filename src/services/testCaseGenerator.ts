import fs from "fs-extra";
import path from "node:path";
// import Anthropic from "@anthropic-ai/sdk";  // TODO: Install @anthropic-ai/sdk package

export interface AuditFinding {
  id: string;
  findingId: string;
  title: string;
  description: string;
  recommendation?: string;
  severity: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  functionName?: string;
  contractName?: string;
  tool?: string;
}

export interface GeneratedTest {
  findingId: string;
  testFileName: string;
  testCode: string;
  framework: 'foundry' | 'hardhat';
  testType: 'unit' | 'fuzz' | 'invariant' | 'integration';
  shouldPass: boolean; // false if testing vulnerability
  vulnerabilityType: VulnerabilityType;
}

export type VulnerabilityType =
  | 'reentrancy'
  | 'access_control'
  | 'arithmetic'
  | 'unchecked_return'
  | 'front_running'
  | 'price_manipulation'
  | 'flash_loan'
  | 'centralization'
  | 'timestamp_dependence'
  | 'tx_origin'
  | 'delegatecall'
  | 'selfdestruct'
  | 'uninitialized_storage'
  | 'logic_error'
  | 'generic';

/**
 * Generate test case for a specific finding
 */
export async function generateTestForFinding(
  finding: AuditFinding,
  sourcePath: string,
  framework: 'foundry' | 'hardhat' = 'foundry'
): Promise<GeneratedTest> {
  // Classify vulnerability type
  const vulnerabilityType = classifyVulnerability(finding);

  // Extract contract code context
  const contractCode = await extractContractCode(
    sourcePath,
    finding.contractName,
    finding.filePath
  );

  // Generate test using Claude
  const testCode = await generateTestWithClaude({
    finding,
    contractCode,
    vulnerabilityType,
    framework,
  });

  // Determine test type based on vulnerability
  const testType = determineTestType(vulnerabilityType);

  return {
    findingId: finding.id,
    testFileName: generateTestFileName(finding, framework),
    testCode,
    framework,
    testType,
    shouldPass: false, // Test should FAIL if vulnerability exists
    vulnerabilityType,
  };
}

/**
 * Classify vulnerability based on finding description
 */
export function classifyVulnerability(finding: AuditFinding): VulnerabilityType {
  const desc = finding.description.toLowerCase();
  const title = finding.title.toLowerCase();
  const combined = `${title} ${desc}`;

  // Reentrancy patterns
  if (
    combined.includes('reentrancy') ||
    combined.includes('reentrant') ||
    combined.includes('checks-effects-interactions')
  ) {
    return 'reentrancy';
  }

  // Access control patterns
  if (
    combined.includes('access control') ||
    combined.includes('unauthorized') ||
    combined.includes('onlyowner') ||
    combined.includes('permission') ||
    combined.includes('privilege')
  ) {
    return 'access_control';
  }

  // Arithmetic patterns
  if (
    combined.includes('overflow') ||
    combined.includes('underflow') ||
    combined.includes('integer') ||
    combined.includes('arithmetic')
  ) {
    return 'arithmetic';
  }

  // Unchecked returns
  if (
    combined.includes('unchecked') ||
    combined.includes('return value') ||
    combined.includes('call return')
  ) {
    return 'unchecked_return';
  }

  // Front-running
  if (
    combined.includes('front-run') ||
    combined.includes('front run') ||
    combined.includes('mev') ||
    combined.includes('sandwich')
  ) {
    return 'front_running';
  }

  // Price manipulation
  if (
    combined.includes('price manipulation') ||
    combined.includes('oracle') ||
    combined.includes('price feed')
  ) {
    return 'price_manipulation';
  }

  // Flash loans
  if (
    combined.includes('flash loan') ||
    combined.includes('flashloan')
  ) {
    return 'flash_loan';
  }

  // Centralization
  if (
    combined.includes('centralization') ||
    combined.includes('single point of failure') ||
    combined.includes('admin key')
  ) {
    return 'centralization';
  }

  // Timestamp dependence
  if (
    combined.includes('timestamp') ||
    combined.includes('block.timestamp') ||
    combined.includes('now')
  ) {
    return 'timestamp_dependence';
  }

  // tx.origin
  if (combined.includes('tx.origin')) {
    return 'tx_origin';
  }

  // delegatecall
  if (combined.includes('delegatecall')) {
    return 'delegatecall';
  }

  // selfdestruct
  if (
    combined.includes('selfdestruct') ||
    combined.includes('suicide')
  ) {
    return 'selfdestruct';
  }

  // Uninitialized storage
  if (
    combined.includes('uninitialized') ||
    combined.includes('storage pointer')
  ) {
    return 'uninitialized_storage';
  }

  // Logic errors
  if (
    combined.includes('logic') ||
    combined.includes('business logic') ||
    combined.includes('invariant')
  ) {
    return 'logic_error';
  }

  return 'generic';
}

/**
 * Extract contract code from source files
 */
async function extractContractCode(
  sourcePath: string,
  contractName?: string,
  filePath?: string
): Promise<string> {
  if (!filePath) {
    return '// Contract code not available';
  }

  try {
    const fullPath = path.join(sourcePath, filePath);
    if (!(await fs.pathExists(fullPath))) {
      return '// Contract file not found';
    }

    const content = await fs.readFile(fullPath, 'utf-8');

    // If contract name specified, try to extract just that contract
    if (contractName) {
      const contractRegex = new RegExp(
        `(contract|interface|library)\\s+${contractName}[\\s{]([\\s\\S]*?)\\n}`,
        'g'
      );
      const match = contractRegex.exec(content);
      if (match) {
        return match[0];
      }
    }

    // Return entire file if contract extraction fails
    return content;
  } catch (error) {
    console.error(`Failed to extract contract code: ${error}`);
    return '// Error reading contract file';
  }
}

/**
 * Generate test code using Claude
 */
async function generateTestWithClaude(params: {
  finding: AuditFinding;
  contractCode: string;
  vulnerabilityType: VulnerabilityType;
  framework: 'foundry' | 'hardhat';
}): Promise<string> {
  const { finding, contractCode, vulnerabilityType, framework } = params;

  // Get appropriate template hint
  const templateHint = getTemplateHint(vulnerabilityType, framework);

  const prompt = `You are an expert smart contract security tester. Generate a COMPREHENSIVE, GOAL-ORIENTED test suite that validates this security finding using established frameworks (STRIDE, OWASP, negative/positive testing).

═══════════════════════════════════════════════════════════
🎯 PRIMARY GOAL: VALIDATE THIS SPECIFIC FINDING
═══════════════════════════════════════════════════════════
- **Finding ID**: ${finding.findingId}
- **Title**: ${finding.title}
- **Severity**: ${finding.severity}
- **Vulnerability Type**: ${vulnerabilityType}
- **Description**: ${finding.description}
${finding.recommendation ? `- **Recommendation**: ${finding.recommendation}` : ''}
${finding.contractName ? `- **Contract**: ${finding.contractName}` : ''}
${finding.functionName ? `- **Function**: ${finding.functionName}` : ''}
${finding.filePath ? `- **Location**: ${finding.filePath}${finding.lineStart ? ':' + finding.lineStart : ''}` : ''}

═══════════════════════════════════════════════════════════
📋 CONTRACT CODE
═══════════════════════════════════════════════════════════
\`\`\`solidity
${contractCode}
\`\`\`

═══════════════════════════════════════════════════════════
🛡️ SECURITY TESTING FRAMEWORKS (APPLY ALL RELEVANT)
═══════════════════════════════════════════════════════════

**STRIDE Analysis** - Apply where relevant:
- Spoofing: Can attacker impersonate another user?
- Tampering: Can attacker modify unauthorized data?
- Repudiation: Can actions be denied?
- Information Disclosure: Is sensitive data exposed?
- Denial of Service: Can attacker block legitimate use?
- Elevation of Privilege: Can attacker gain unauthorized access?

**OWASP Smart Contract Top 10** - Map to category:
- Reentrancy, Access Control, Arithmetic, Unchecked Calls, DoS
- Bad Randomness, Front-Running, Time Manipulation, etc.

**Negative vs Positive Testing** - BOTH are REQUIRED:
- POSITIVE: Test legitimate operations work correctly (should PASS)
- NEGATIVE: Test exploit attempts (should FAIL if vuln exists, or REVERT if fixed)

═══════════════════════════════════════════════════════════
✅ REQUIRED TEST STRUCTURE
═══════════════════════════════════════════════════════════

Generate a ${framework === 'foundry' ? 'Foundry' : 'Hardhat'} test file with this EXACT structure:

\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * ═══════════════════════════════════════════════════════════
 * SECURITY TEST SUITE FOR FINDING: ${finding.findingId}
 * ═══════════════════════════════════════════════════════════
 *
 * 🎯 GOAL: ${finding.title}
 * 📊 SEVERITY: ${finding.severity}
 * 🔍 TYPE: ${vulnerabilityType}
 *
 * ═══════════════════════════════════════════════════════════
 * 📝 PURPOSE
 * ═══════════════════════════════════════════════════════════
 * This test suite validates the finding by testing:
 * 1. ✅ POSITIVE cases - Expected legitimate behavior
 * 2. ❌ NEGATIVE cases - Exploit attempts
 * 3. 🛡️ STRIDE framework vectors
 * 4. 📋 OWASP vulnerability patterns
 * 5. 🔬 Edge cases and boundaries
 *
 * ═══════════════════════════════════════════════════════════
 * 🚀 SETUP
 * ═══════════════════════════════════════════════════════════
 * Run: forge test --match-contract Test_Finding_${finding.findingId.replace(/[^a-zA-Z0-9]/g, '_')} -vvv
 *
 * ═══════════════════════════════════════════════════════════
 * 📊 EXPECTED RESULTS
 * ═══════════════════════════════════════════════════════════
 * If vulnerability EXISTS:
 * - Positive tests PASS (normal functionality works)
 * - Exploit tests FAIL (vulnerability demonstrated)
 *
 * If vulnerability FIXED:
 * - Positive tests PASS
 * - Exploit tests REVERT (vulnerability prevented)
 *
 * ═══════════════════════════════════════════════════════════
 * ⚠️ IMPACT
 * ═══════════════════════════════════════════════════════════
 * ${finding.description}
 * ═══════════════════════════════════════════════════════════
 */

import "forge-std/Test.sol";
// Add other imports as needed

contract Test_Finding_${finding.findingId.replace(/[^a-zA-Z0-9]/g, '_')} is Test {
    // Declare contract instances, test accounts, etc.
    address attacker = address(0xBAD);
    address victim = address(0x1);
    address admin = address(0xADMIN);

    function setUp() public {
        // Initialize test environment
        // Deploy contracts
        // Setup initial state
        // Fund accounts
    }

    // ═══════════════════════════════════════════════════════════
    // ✅ POSITIVE TESTS (Expected Legitimate Behavior)
    // ═══════════════════════════════════════════════════════════

    /// @notice Test that legitimate users can perform valid operations
    /// @dev This should PASS showing normal functionality works
    function test_Positive_LegitimateOperation() public {
        // Test normal user flow
        // Verify state changes correctly
        // Assert expected outcomes
    }

    // ═══════════════════════════════════════════════════════════
    // ❌ NEGATIVE TESTS (Exploit Scenarios)
    // ═══════════════════════════════════════════════════════════

    /// @notice Main exploit test for the vulnerability
    /// @dev This should FAIL if vuln exists (exploit succeeds)
    /// @dev OR should REVERT if vulnerability is fixed
    function test_Negative_ExploitVulnerability() public {
        // Setup exploit scenario
        // Attempt to exploit the vulnerability
        // Assert exploit succeeded (if vuln exists) OR expect revert (if fixed)
    }

    /// @notice Test boundary conditions
    function test_Negative_BoundaryConditions() public {
        // Test edge cases
    }

    // ═══════════════════════════════════════════════════════════
    // 🛡️ STRIDE-BASED TESTS (Apply relevant vectors)
    // ═══════════════════════════════════════════════════════════

    /// @notice STRIDE: Test spoofing/impersonation
    function test_STRIDE_Spoofing() public {
        // Can attacker impersonate legitimate user?
    }

    /// @notice STRIDE: Test unauthorized tampering
    function test_STRIDE_Tampering() public {
        // Can attacker modify protected data?
    }

    /// @notice STRIDE: Test privilege escalation
    function test_STRIDE_ElevationOfPrivilege() public {
        // Can attacker gain unauthorized access?
    }

    // ═══════════════════════════════════════════════════════════
    // 📋 OWASP-BASED TESTS (Map to specific vulnerability)
    // ═══════════════════════════════════════════════════════════

    // Add OWASP tests based on vulnerability type
    // Examples: test_OWASP_Reentrancy, test_OWASP_AccessControl, etc.
}

// ═══════════════════════════════════════════════════════════
// 💀 ATTACK CONTRACT (if needed for exploit)
// ═══════════════════════════════════════════════════════════
contract AttackerContract {
    // Implement attack logic if needed
}
\`\`\`

═══════════════════════════════════════════════════════════
💡 FRAMEWORK-SPECIFIC HINTS
═══════════════════════════════════════════════════════════
${templateHint}

═══════════════════════════════════════════════════════════
🎯 CRITICAL REQUIREMENTS
═══════════════════════════════════════════════════════════
1. ✅ Every test MUST map directly to the finding
2. ✅ Include BOTH positive and negative tests
3. ✅ Apply STRIDE and OWASP frameworks
4. ✅ Test should be SPECIFIC to this finding, not generic
5. ✅ Include detailed inline comments
6. ✅ Make tests runnable as-is
7. ✅ Return ONLY code - NO explanations before/after

Generate the comprehensive test suite NOW:`;

  try {
    // Use Claude CLI for test generation
    const { executeStreamingClaude } = await import('./ai/simpleClaudeExecutor.js');

    // Execute with Claude CLI
    const result = await executeStreamingClaude(prompt, {
      timeout: 300000, // 5 minutes for test generation
      model: 'claude-sonnet-4-5-20250929',
    });

    let testCode = result.output || '';

    // Remove markdown code blocks if present
    testCode = testCode.replace(/^```[a-z]*\n/im, '');
    testCode = testCode.replace(/\n```$/im, '');
    testCode = testCode.trim();

    return testCode;
  } catch (error: any) {
    console.error(`Failed to generate test with Claude: ${error.message}`);

    // Fallback to template-based generation
    return generateFallbackTest(finding, vulnerabilityType, framework);
  }
}

/**
 * Get template hint based on vulnerability type
 */
function getTemplateHint(
  vulnerabilityType: VulnerabilityType,
  framework: 'foundry' | 'hardhat'
): string {
  const hints: Record<VulnerabilityType, string> = {
    reentrancy: `For reentrancy tests:
- Create an attacker contract with a fallback/receive function
- Call the vulnerable function from the attacker
- In fallback, make a reentrant call
- Test should expect revert with "ReentrancyGuard" or demonstrate fund drain`,

    access_control: `For access control tests:
- Create unauthorized user address (address(0xBEEF))
- Use vm.prank() to impersonate unauthorized user
- Attempt to call restricted function
- Test should expect revert with access control error`,

    arithmetic: `For arithmetic overflow/underflow tests:
- Set up values that will cause overflow/underflow
- Perform the vulnerable operation
- Test should expect revert or check for incorrect result`,

    unchecked_return: `For unchecked return value tests:
- Mock a call that returns false
- Execute vulnerable function that ignores return value
- Verify the transaction doesn't revert when it should`,

    front_running: `For front-running tests:
- Set up initial state
- Simulate attacker seeing pending transaction
- Execute attacker transaction first
- Show how attacker profits or causes harm`,

    price_manipulation: `For price manipulation tests:
- Deploy mock oracle or price feed
- Manipulate price via large swap or oracle update
- Show how manipulated price affects vulnerable function`,

    flash_loan: `For flash loan attack tests:
- Use Foundry's deal() to simulate flash loan
- Execute attack in single transaction
- Show how borrowed funds exploit vulnerability
- Repay flash loan in same transaction`,

    centralization: `For centralization risk tests:
- Show admin/owner can perform critical action
- Demonstrate impact if admin key compromised
- Test should highlight the centralized control`,

    timestamp_dependence: `For timestamp dependence tests:
- Use vm.warp() to manipulate block.timestamp
- Show how timestamp manipulation affects logic
- Demonstrate unfair advantage or broken logic`,

    tx_origin: `For tx.origin vulnerability tests:
- Create malicious contract
- User calls malicious contract
- Malicious contract calls vulnerable contract
- tx.origin passes but shouldn't`,

    delegatecall: `For delegatecall vulnerability tests:
- Show how delegatecall can modify storage
- Demonstrate storage slot collision
- Test unauthorized state changes`,

    selfdestruct: `For selfdestruct vulnerability tests:
- Show how selfdestruct can affect contract
- Demonstrate forced ether transfer
- Test impact on contract logic`,

    uninitialized_storage: `For uninitialized storage tests:
- Access uninitialized storage variable
- Show unexpected value or behavior
- Demonstrate security impact`,

    logic_error: `For logic error tests:
- Set up conditions that trigger incorrect logic
- Execute vulnerable function
- Assert incorrect state or behavior`,

    generic: `For this vulnerability:
- Set up test environment
- Execute vulnerable code path
- Demonstrate the security issue
- Use clear assertions to show the problem`,
  };

  return hints[vulnerabilityType] || hints.generic;
}

/**
 * Fallback test generation (template-based)
 */
function generateFallbackTest(
  finding: AuditFinding,
  vulnerabilityType: VulnerabilityType,
  framework: 'foundry' | 'hardhat'
): string {
  if (framework === 'foundry') {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

/**
 * Test for: ${finding.title}
 * Severity: ${finding.severity}
 * Type: ${vulnerabilityType}
 *
 * Description: ${finding.description}
 */
contract Test_Finding_${finding.findingId.replace(/[^a-zA-Z0-9]/g, '_')} is Test {

    function setUp() public {
        // TODO: Deploy contracts and set up test environment
    }

    function test_${vulnerabilityType}_vulnerability() public {
        // TODO: Implement test case
        // This test should demonstrate the vulnerability exists

        fail("Test case needs implementation - see finding description above");
    }
}
`;
  } else {
    return `import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Test for: ${finding.title}
 * Severity: ${finding.severity}
 * Type: ${vulnerabilityType}
 *
 * Description: ${finding.description}
 */
describe("Finding ${finding.findingId}", function () {

  beforeEach(async function () {
    // TODO: Deploy contracts and set up test environment
  });

  it("should demonstrate ${vulnerabilityType} vulnerability", async function () {
    // TODO: Implement test case
    // This test should demonstrate the vulnerability exists

    expect.fail("Test case needs implementation - see finding description above");
  });
});
`;
  }
}

/**
 * Determine test type based on vulnerability
 */
function determineTestType(
  vulnerabilityType: VulnerabilityType
): 'unit' | 'fuzz' | 'invariant' | 'integration' {
  // Arithmetic, reentrancy, logic errors benefit from fuzz testing
  if (['arithmetic', 'reentrancy', 'logic_error', 'unchecked_return'].includes(vulnerabilityType)) {
    return 'fuzz';
  }

  // Integration tests for complex interactions
  if (['flash_loan', 'price_manipulation', 'front_running'].includes(vulnerabilityType)) {
    return 'integration';
  }

  // Most security tests are unit tests
  return 'unit';
}

/**
 * Generate test file name
 */
function generateTestFileName(
  finding: AuditFinding,
  framework: 'foundry' | 'hardhat'
): string {
  const sanitizedId = finding.findingId.replace(/[^a-zA-Z0-9]/g, '_');
  const extension = framework === 'foundry' ? 't.sol' : 'ts';
  return `test_finding_${sanitizedId}.${extension}`;
}

/**
 * Detect test framework from project structure
 */
export async function detectTestFramework(sourcePath: string): Promise<'foundry' | 'hardhat'> {
  // Check for foundry.toml
  if (await fs.pathExists(path.join(sourcePath, 'foundry.toml'))) {
    return 'foundry';
  }

  // Check for hardhat.config.js/ts
  if (
    (await fs.pathExists(path.join(sourcePath, 'hardhat.config.js'))) ||
    (await fs.pathExists(path.join(sourcePath, 'hardhat.config.ts')))
  ) {
    return 'hardhat';
  }

  // Default to foundry
  return 'foundry';
}
