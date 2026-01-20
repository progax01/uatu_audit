/**
 * Token Security Module
 *
 * Specialized audit steps for ERC20/721/1155 tokens with focus on:
 * - Tax mechanisms (buy/sell/transfer)
 * - Honeypot detection (hidden restrictions)
 * - Ownership centralization risks
 * - Mint/burn controls
 */

import type { SOPModule } from './types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'token-security' });

export const tokenSecurityModule: SOPModule = {
  id: 'token-security-checks',
  name: 'Token Contract Security',
  description: 'Specialized analysis for token contracts focusing on tax mechanisms, honeypot patterns, and centralization',
  priority: 10,

  applicableWhen: (context) => {
    return context.data?.contractPatterns?.token?.isToken === true;
  },

  requiredData: ['contracts', 'contractPatterns'],

  additionalSteps: [
    // ========================================================================
    // STEP 1: Tax Mechanism Analysis
    // ========================================================================
    {
      id: 'analyze-tax-structure',
      name: 'Tax Mechanism Analysis',
      description: 'Extract and validate buy/sell/transfer tax logic',
      executor: 'deterministic',
      executorConfig: {
        type: 'deterministic',
        function: 'analyzeTaxStructure',
      },
      estimatedDurationSeconds: 30,
      timeoutSeconds: 60,
      dependsOn: ['parse-solidity-ast'],
      provides: ['tokenTaxAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'static-analysis',
      aiAssisted: false,
      progressWeight: 10,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 2: Honeypot Detection
    // ========================================================================
    {
      id: 'detect-honeypot',
      name: 'Honeypot Pattern Detection',
      description: 'Check for hidden restrictions that prevent selling',
      executor: 'ai-prompt',
      executorConfig: {
        type: 'ai-prompt',
        prompt: `You are analyzing a token contract for honeypot patterns that trap investors.

HONEYPOT PATTERNS TO DETECT:

1. **Hidden Sell Restrictions**:
   - Transfer only works for certain addresses
   - Selling blocked after buying
   - Cooldown periods that prevent selling

2. **Hidden Mint Functions**:
   - Internal/private mint that dilutes holders
   - Mint without proper access control
   - Backdoor minting mechanisms

3. **Blacklist Mechanisms**:
   - Owner can blacklist addresses from selling
   - Automatic blacklisting on certain actions
   - Permanent blacklisting without redemption

4. **Ownership Backdoors**:
   - Hidden owner functions in parents/libraries
   - Proxy patterns that allow owner to change logic
   - Delegatecall to attacker-controlled contracts

5. **Tax Rate Manipulation**:
   - Owner can set 100% sell tax
   - No maximum tax rate limit
   - Different tax rates for different users

TOKEN INFO:
Standard: {{contractPatterns.token.standard}}
Has Tax: {{contractPatterns.token.hasTaxMechanism}}
Tax Rates: Buy={{contractPatterns.token.taxRates.buy}}% Sell={{contractPatterns.token.taxRates.sell}}% Transfer={{contractPatterns.token.taxRates.transfer}}%
Can Mint: {{contractPatterns.token.canMint}}
Can Pause: {{contractPatterns.token.canPause}}
Ownership Renounced: {{contractPatterns.token.ownershipRenounced}}

CONTRACTS:
{{#each contracts}}
{{#if (contains this.functions "transfer")}}
File: {{this.path}}
\`\`\`solidity
{{this.content}}
\`\`\`
{{/if}}
{{/each}}

ANALYSIS CHECKLIST:

1. **Transfer Function Analysis**:
   \`\`\`solidity
   // Check for hidden conditions
   function _transfer(address from, address to, uint256 amount) internal {
       // RED FLAG: Only owner can sell?
       require(from == owner || to == owner, "Not authorized");

       // RED FLAG: Cooldown prevents selling?
       require(block.timestamp > lastTransfer[from] + cooldown, "Wait");

       // RED FLAG: Blacklist blocks selling?
       require(!blacklisted[from], "Blacklisted");

       // RED FLAG: Different rules for different addresses?
       if (isExchange[to]) { // Selling
           require(canSell[from], "Cannot sell");
       }
   }
   \`\`\`

2. **Hidden Mint Detection**:
   - Look for internal/private mint functions
   - Check if mint can be called without restrictions
   - Verify if totalSupply can be changed arbitrarily

3. **Tax Rate Bounds**:
   - Check if tax rates have maximum limits
   - Can owner set 100% tax effectively burning tokens?
   - Are there timelock delays before tax changes?

4. **Ownership Renouncement**:
   - Is ownership truly renounced or can it be reclaimed?
   - Are there proxy patterns that bypass renouncement?

Return JSON:
{
  "isHoneypot": boolean,
  "honeypotConfidence": "high|medium|low",
  "honeypotIndicators": [
    {
      "type": "hidden_mint|sell_restriction|blacklist|tax_manipulation|ownership_backdoor",
      "severity": "critical|high",
      "description": "what makes this a honeypot",
      "location": "file:line",
      "evidence": "code snippet showing the issue"
    }
  ],
  "safeguards": [
    {
      "type": "max_tax_limit|timelock|ownership_renounced",
      "present": boolean,
      "description": "what protection exists"
    }
  ],
  "findings": [
    {
      "severity": "critical|high|medium",
      "title": "Honeypot: [specific issue]",
      "description": "how this traps investors",
      "location": "file:line",
      "recommendation": "remove restriction / add safeguards",
      "code_snippet": "problematic code"
    }
  ]
}`,
        model: 'claude-sonnet-4-5',
        maxTokens: 4096,
        temperature: 0,
      },
      estimatedDurationSeconds: 60,
      timeoutSeconds: 120,
      dependsOn: ['analyze-tax-structure'],
      provides: ['tokenHoneypotAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'ai-analysis',
      aiAssisted: true,
      progressWeight: 15,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 3: Ownership Centralization Analysis
    // ========================================================================
    {
      id: 'check-ownership-risks',
      name: 'Ownership Centralization Analysis',
      description: 'Analyze admin privileges and centralization risks',
      executor: 'ai-prompt',
      executorConfig: {
        type: 'ai-prompt',
        prompt: `You are analyzing token ownership centralization and rug pull risks.

CENTRALIZATION RISKS:
1. **Unlimited Minting**: Owner can mint unlimited tokens diluting holders
2. **Pause Mechanism**: Owner can freeze all transfers permanently
3. **Tax Control**: Owner can set confiscatory tax rates
4. **Blacklist Power**: Owner can prevent specific addresses from trading
5. **Withdrawal Functions**: Owner can drain contract balance

TOKEN CONTROLS:
Can Mint: {{contractPatterns.token.canMint}}
Can Burn: {{contractPatterns.token.canBurn}}
Can Pause: {{contractPatterns.token.canPause}}
Can Change Tax: {{contractPatterns.token.canChangeTax}}
Ownership Renounced: {{contractPatterns.token.ownershipRenounced}}

ADMIN FUNCTIONS:
{{#each contractPatterns.vault.adminFunctions}}
- {{this}}
{{/each}}

CONTRACTS:
{{#each contracts}}
File: {{this.path}}
\`\`\`solidity
{{this.content}}
\`\`\`
{{/each}}

ANALYSIS:

1. **Mint Control Assessment**:
   - Can owner mint without limit?
   - Is there a max supply cap?
   - Does minting require governance/timelock?
   - Severity: Critical if unlimited, High if capped

2. **Pause Mechanism**:
   - Can owner pause all transfers?
   - Is there an unpause function?
   - Can pause be made permanent?
   - Severity: High if pausable, Medium if time-limited

3. **Tax Manipulation**:
   - Can owner set 100% tax?
   - Is there a max tax rate (e.g., 10%)?
   - Are there timelock delays before changes?
   - Severity: Critical if unlimited, Medium if capped

4. **Blacklist Power**:
   - Can owner blacklist any address?
   - Is there a way to remove from blacklist?
   - Can blacklist be used to block selling?
   - Severity: High if permanent, Medium if reversible

5. **Fund Extraction**:
   - Can owner withdraw tokens from contract?
   - Can owner withdraw ETH/native tokens?
   - Are there legitimate reasons (e.g., tax collection)?
   - Severity: Critical if arbitrary withdrawal

6. **Ownership Renouncement**:
   - Is renounceOwnership() called in deployment?
   - Can ownership be reclaimed through proxy?
   - Are admin functions still accessible after renouncement?

7. **Mitigation Analysis**:
   - Timelock for changes (48 hour delay)
   - Multi-sig requirements
   - On-chain governance votes
   - Hard-coded limits in code

Return JSON:
{
  "centralizationRisk": "critical|high|medium|low",
  "rugPullPossible": boolean,
  "risks": [
    {
      "type": "unlimited_mint|pause_control|tax_manipulation|blacklist|fund_extraction",
      "severity": "critical|high|medium",
      "description": "what owner can do",
      "impact": "how this harms users",
      "mitigations": ["timelock", "multisig", etc],
      "hasTimelockProtection": boolean
    }
  ],
  "findings": [
    {
      "severity": "critical|high|medium",
      "title": "Centralization: [specific risk]",
      "description": "owner power and potential abuse",
      "location": "file:line",
      "recommendation": "renounce ownership / add timelock / implement governance",
      "code_snippet": "owner-controlled function"
    }
  ]
}`,
        model: 'claude-sonnet-4-5',
        maxTokens: 4096,
        temperature: 0,
      },
      estimatedDurationSeconds: 60,
      timeoutSeconds: 120,
      dependsOn: ['detect-honeypot'],
      provides: ['tokenOwnershipAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'ai-analysis',
      aiAssisted: true,
      progressWeight: 15,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 4: ERC20 Compliance Verification
    // ========================================================================
    {
      id: 'verify-erc20-compliance',
      name: 'ERC20 Standard Compliance',
      description: 'Verify token implements ERC20 standard correctly',
      executor: 'deterministic',
      executorConfig: {
        type: 'deterministic',
        function: 'verifyERC20Compliance',
      },
      estimatedDurationSeconds: 30,
      timeoutSeconds: 60,
      dependsOn: ['check-ownership-risks'],
      provides: ['tokenComplianceAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'static-analysis',
      aiAssisted: false,
      progressWeight: 10,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },
  ],
};

export default tokenSecurityModule;
