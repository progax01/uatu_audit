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

  const prompt = `You are a smart contract security auditor generating a test case to verify a vulnerability.

## Finding Details
- **ID:** ${finding.findingId}
- **Title:** ${finding.title}
- **Severity:** ${finding.severity}
- **Description:** ${finding.description}
${finding.recommendation ? `- **Recommendation:** ${finding.recommendation}` : ''}
${finding.filePath ? `- **File:** ${finding.filePath}` : ''}
${finding.lineStart ? `- **Line:** ${finding.lineStart}` : ''}
${finding.functionName ? `- **Function:** ${finding.functionName}` : ''}
${finding.contractName ? `- **Contract:** ${finding.contractName}` : ''}

## Vulnerability Type
${vulnerabilityType}

## Contract Code
\`\`\`solidity
${contractCode}
\`\`\`

## Template Guidance
${templateHint}

## Instructions
Generate a complete ${framework === 'foundry' ? 'Foundry' : 'Hardhat'} test file that:

1. **Tests the vulnerability** - The test should demonstrate the vulnerability exists
2. **Should FAIL initially** - Proving the vulnerability is present
3. **Includes clear comments** - Explain the exploit step-by-step
4. **Uses proper setup** - Deploy contracts, set initial state
5. **Follows best practices** - Use appropriate test patterns for ${framework}

**IMPORTANT:**
- Return ONLY the test code, no explanations before or after
- Include all necessary imports
- Make the test runnable as-is
- Add inline comments explaining the vulnerability
- The test should FAIL (or expect revert) to prove the vulnerability

Generate the test code now:`;

  try {
    // TODO: Install @anthropic-ai/sdk package before enabling this functionality
    throw new Error('@anthropic-ai/sdk package not installed. Install with: npm install @anthropic-ai/sdk');

    /* Commented out until package is installed
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.2, // Low temperature for consistent code generation
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract code from response (remove any markdown formatting)
    let testCode = content.text.trim();

    // Remove markdown code blocks if present
    testCode = testCode.replace(/^```[a-z]*\n/i, '');
    testCode = testCode.replace(/\n```$/i, '');

    return testCode;
    */
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
