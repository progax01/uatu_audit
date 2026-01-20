/**
 * DeFi Vault Security Module
 *
 * Specialized audit steps for DeFi vault contracts (ERC4626, custom vaults).
 * Focuses on:
 * - Share calculation math (inflation attacks, rounding errors)
 * - Reentrancy in deposit/withdraw flows
 * - Oracle staleness and manipulation
 * - Admin privilege escalation
 */

import type { SOPModule } from './types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'defi-vault' });

export const defiVaultModule: SOPModule = {
  id: 'defi-vault-checks',
  name: 'DeFi Vault Security Checks',
  description: 'Specialized analysis for vault contracts focusing on share accounting, reentrancy, and oracle risks',
  priority: 10,

  applicableWhen: (context) => {
    return context.data?.contractPatterns?.vault?.isVault === true;
  },

  requiredData: ['contracts', 'contractPatterns'],

  additionalSteps: [
    // ========================================================================
    // STEP 1: Share Math Verification
    // ========================================================================
    {
      id: 'analyze-share-math',
      name: 'Verify Share Calculation Logic',
      description: 'Analyze share minting/burning math for inflation attacks and rounding errors',
      executor: 'ai-prompt',
      executorConfig: {
        type: 'ai-prompt',
        prompt: `You are auditing a DeFi vault contract for share calculation vulnerabilities.

CRITICAL RISKS TO CHECK:
1. **Inflation Attack**: Can an attacker donate assets to manipulate share price before first deposit?
2. **Rounding Errors**: Are shares calculated with proper precision? Check for loss of funds due to rounding.
3. **First Depositor Advantage**: Is the first depositor protected from inflation attacks?
4. **Deposit/Withdraw Parity**: Do deposit→withdraw and withdraw→deposit cycles preserve value?

VAULT CONTEXT:
{{#if contractPatterns.vault.vaultType}}
Vault Type: {{contractPatterns.vault.vaultType}}
{{/if}}
{{#if contractPatterns.vault.hasSharesAccounting}}
Has Shares Accounting: Yes
{{/if}}

CONTRACTS TO ANALYZE:
{{#each contracts}}
{{#if (contains this.path "Vault")}}
File: {{this.path}}
\`\`\`solidity
{{this.content}}
\`\`\`
{{/if}}
{{/each}}

ANALYSIS REQUIRED:

1. **Share Formula Analysis**:
   - Locate deposit(), mint(), withdraw(), redeem() functions
   - Extract the formula: shares = (assets * totalSupply) / totalAssets
   - Check for precision loss, division before multiplication
   - Verify rounding direction (user vs protocol)

2. **First Deposit Protection**:
   - Check if initial shares ≠ assets (prevents inflation)
   - Look for minimum deposit requirements
   - Verify locked shares or dead shares pattern

3. **Inflation Attack Vector**:
   - Can attacker directly transfer assets to vault before first deposit?
   - Does totalAssets() include donated assets?
   - Is there a dead shares mechanism or minimum liquidity?

4. **Edge Cases**:
   - What happens when totalSupply = 0?
   - What happens when totalAssets = 0?
   - Are there SafeMath checks for overflow?

Return JSON:
{
  "shareFormulaCorrect": boolean,
  "firstDepositProtected": boolean,
  "inflationAttackPossible": boolean,
  "roundingIssues": [
    {
      "location": "file:line",
      "issue": "description",
      "severity": "critical|high|medium",
      "recommendation": "fix"
    }
  ],
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "finding title",
      "description": "detailed explanation",
      "location": "file:line",
      "recommendation": "how to fix",
      "code_snippet": "vulnerable code"
    }
  ]
}`,
        model: 'claude-sonnet-4-5',
        maxTokens: 4096,
        temperature: 0,
      },
      estimatedDurationSeconds: 60,
      timeoutSeconds: 120,
      dependsOn: ['parse-solidity-ast'],
      provides: ['vaultShareMathAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'ai-analysis',
      aiAssisted: true,
      progressWeight: 15,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 2: Vault Reentrancy Analysis
    // ========================================================================
    {
      id: 'check-vault-reentrancy',
      name: 'Vault Reentrancy Analysis',
      description: 'Check deposit/withdraw flows for reentrancy vectors',
      executor: 'ai-prompt',
      executorConfig: {
        type: 'ai-prompt',
        prompt: `You are analyzing a DeFi vault for reentrancy vulnerabilities.

VAULT REENTRANCY PATTERNS:
1. **Deposit Reentrancy**: External call before shares minted
2. **Withdraw Reentrancy**: External call before shares burned
3. **Read-Only Reentrancy**: View functions called mid-transaction returning stale data
4. **Cross-Function Reentrancy**: Reenter through different function

VAULT INFO:
Has Reentrancy Guards: {{contractPatterns.vault.hasReentrancyGuards}}

CONTRACTS:
{{#each contracts}}
{{#if (or (contains this.path "Vault") (contains this.functions "deposit"))}}
File: {{this.path}}
\`\`\`solidity
{{this.content}}
\`\`\`
{{/if}}
{{/each}}

ANALYSIS STEPS:

1. **Identify External Calls**:
   - In deposit(), mint(), withdraw(), redeem()
   - token.transfer(), token.transferFrom()
   - Strategy calls, oracle calls
   - Note: External calls after state changes are vulnerable

2. **Check State Change Order** (CEI Pattern):
   - ✅ SAFE: Update state → External call
   - ❌ UNSAFE: External call → Update state
   - Check: shares minted/burned BEFORE or AFTER asset transfer?

3. **Cross-Function Reentrancy**:
   - Can attacker reenter deposit() during withdraw()?
   - Are totalAssets() and totalSupply() consistent during reentrancy?

4. **Read-Only Reentrancy**:
   - Do view functions (totalAssets, convertToShares) rely on external state?
   - Can oracle calls be manipulated mid-transaction?

Return JSON:
{
  "hasReentrancyGuard": boolean,
  "vulnerableFunctions": [
    {
      "function": "deposit|withdraw|mint|redeem",
      "severity": "critical|high|medium",
      "externalCalls": ["call1", "call2"],
      "stateChangesAfterCall": boolean,
      "canReenter": boolean,
      "reentrancyPath": "description of attack path"
    }
  ],
  "findings": [
    {
      "severity": "critical|high|medium",
      "title": "Reentrancy in [function]",
      "description": "detailed explanation with attack scenario",
      "location": "file:line",
      "recommendation": "Add nonReentrant modifier / Follow CEI pattern",
      "code_snippet": "vulnerable code"
    }
  ]
}`,
        model: 'claude-sonnet-4-5',
        maxTokens: 4096,
        temperature: 0,
      },
      estimatedDurationSeconds: 60,
      timeoutSeconds: 120,
      dependsOn: ['analyze-share-math'],
      provides: ['vaultReentrancyAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'ai-analysis',
      aiAssisted: true,
      progressWeight: 15,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 3: Oracle Staleness Verification
    // ========================================================================
    {
      id: 'verify-oracle-staleness',
      name: 'Oracle Staleness Protection',
      description: 'Verify price oracles have staleness checks and fallbacks',
      executor: 'ai-prompt',
      executorConfig: {
        type: 'ai-prompt',
        prompt: `You are auditing oracle usage in a DeFi vault for staleness and manipulation risks.

ORACLE RISKS:
1. **Stale Data**: Using outdated prices can cause under-collateralization
2. **Circuit Breaker**: Oracle stops updating during extreme volatility
3. **No Fallback**: Single point of failure if oracle fails
4. **Price Manipulation**: Flash loan attacks on oracle sources

DETECTED ORACLES:
{{#each contractPatterns.vault.oracleDependencies}}
- Oracle: {{this.name}}
  Has Staleness Check: {{this.hasStalenessFallback}}
  Has Fallback: {{this.hasFallback}}
{{/each}}

CONTRACTS:
{{#each contracts}}
{{#if (contains this.content "oracle")}}
File: {{this.path}}
\`\`\`solidity
{{this.content}}
\`\`\`
{{/if}}
{{/each}}

ANALYSIS CHECKLIST:

1. **Staleness Checks**:
   - Does code check updatedAt timestamp?
   - Is there a maximum age threshold (e.g., 1 hour)?
   - What happens if data is stale? (revert vs fallback)

2. **Answer Validation**:
   - Are price bounds checked (min/max reasonable values)?
   - Is answeredInRound validated against roundId?
   - Are negative prices rejected?

3. **Fallback Mechanisms**:
   - Is there a secondary oracle?
   - Is there a TWAP fallback?
   - Can system pause if all oracles fail?

4. **Chainlink Specific**:
   \`\`\`solidity
   // SAFE pattern
   (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = oracle.latestRoundData();
   require(answer > 0, "Invalid price");
   require(updatedAt >= block.timestamp - 3600, "Stale price");
   require(answeredInRound >= roundId, "Stale round");
   \`\`\`

Return JSON:
{
  "oraclesFound": number,
  "allHaveStalenessCheck": boolean,
  "hasFallbackMechanism": boolean,
  "vulnerableOracles": [
    {
      "oracle": "name/address",
      "missingStalenessCheck": boolean,
      "missingBoundsCheck": boolean,
      "noFallback": boolean,
      "severity": "high|medium",
      "location": "file:line"
    }
  ],
  "findings": [
    {
      "severity": "high|medium",
      "title": "Oracle [issue]",
      "description": "explanation with impact",
      "location": "file:line",
      "recommendation": "add staleness check / add fallback",
      "code_snippet": "vulnerable oracle call"
    }
  ]
}`,
        model: 'claude-sonnet-4-5',
        maxTokens: 4096,
        temperature: 0,
      },
      estimatedDurationSeconds: 60,
      timeoutSeconds: 120,
      dependsOn: ['check-vault-reentrancy'],
      provides: ['vaultOracleAnalysis'],
      requires: ['contracts', 'contractPatterns'],
      category: 'ai-analysis',
      aiAssisted: true,
      progressWeight: 15,
      required: false,
      retryCount: 1,
      continueOnFailure: true,
    },

    // ========================================================================
    // STEP 4: Admin Privilege Analysis
    // ========================================================================
    {
      id: 'analyze-vault-admin-risks',
      name: 'Vault Admin Privilege Analysis',
      description: 'Analyze admin functions for centralization and rug pull risks',
      executor: 'deterministic',
      executorConfig: {
        type: 'deterministic',
        function: 'analyzeVaultAdminRisks',
      },
      estimatedDurationSeconds: 30,
      timeoutSeconds: 60,
      dependsOn: ['verify-oracle-staleness'],
      provides: ['vaultAdminRiskAnalysis'],
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

export default defiVaultModule;
