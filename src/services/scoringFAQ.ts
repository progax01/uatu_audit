/**
 * Scoring & Grading FAQ
 * Comprehensive explanation of how audit scores are calculated
 */

export const SCORING_FAQ = {
  overview: {
    title: "How is the audit score calculated?",
    answer: `Audits start with a perfect score of 100. Points are deducted based on the severity and exploitability of findings.

We use a nuanced scoring system that considers:
1. **Severity Level**: Critical, High, Medium, Low
2. **Exploitability Category**: Immediate, Conditional, or Theoretical
3. **Scope**: Internal (your code) vs External (third-party dependencies)

This ensures that **immediate, directly exploitable issues** are weighted much heavier than **theoretical issues requiring third-party contracts to be malicious**.`
  },

  severityWeights: {
    title: "What are the base penalty weights for each severity?",
    answer: `Base penalties (for IMMEDIATE risks):

• **Critical**: -25 points
  - Leads to direct loss of funds, complete contract takeover, or catastrophic failure
  - Examples: Reentrancy allowing theft, unchecked arithmetic causing overflow, authorization bypass

• **High**: -12 points
  - Could lead to significant losses under realistic conditions
  - Examples: Flash loan attacks, price manipulation, access control issues

• **Medium**: -5 points
  - Requires specific conditions OR has limited impact
  - Examples: Front-running opportunities, gas griefing, locked funds scenarios

• **Low**: -2 points
  - Minor issues with minimal impact or very unlikely to occur
  - Examples: Missing event emissions, suboptimal gas patterns, documentation issues

• **Info**: 0 points
  - Best practice recommendations, code quality improvements
  - No security impact, purely informational`
  },

  exploitabilityCategories: {
    title: "What are the exploitability categories?",
    answer: `We categorize vulnerabilities into 3 types based on exploitability:

**1. IMMEDIATE (100% of base penalty)**
   - **Definition**: Directly exploitable with no special conditions
   - **Examples**:
     - Direct reentrancy with no external dependency
     - Unchecked return values causing silent failures
     - Missing access control allowing anyone to call privileged functions
   - **Scoring**: Full penalty applied
   - **Your responsibility**: Fix immediately before production

**2. CONDITIONAL (60% of base penalty)**
   - **Definition**: Requires specific timing, user actions, or market conditions
   - **Examples**:
     - Front-running attacks requiring mempool monitoring
     - Flash loan attacks requiring available liquidity
     - Issues requiring specific parameter values or edge cases
   - **Scoring**: 60% of base penalty (40% discount)
   - **Why discounted**: Not exploitable at will, requires opportunity window
   - **Your responsibility**: Consider if conditions are likely in your use case

**3. THEORETICAL (30% of base penalty)**
   - **Definition**: Requires third-party contracts to be compromised/malicious
   - **Examples**:
     - "If USDC token is malicious, reentrancy is possible"
     - "If PSM contract is compromised via upgrade..."
     - "If oracle returns manipulated price..."
   - **Scoring**: 30% of base penalty (70% discount)
   - **Why discounted**: Depends on external party being malicious, not directly your fault
   - **Your responsibility**: Document trust assumptions, consider defense-in-depth

**Why this matters**:
A "Medium" severity reentrancy issue that requires the USDC contract to be malicious gets scored as:
• Base Medium penalty: 5 points
• Theoretical multiplier: 0.3x
• **Actual deduction: 1.5 points**

Versus an immediate Medium issue:
• Base Medium penalty: 5 points
• Immediate multiplier: 1.0x
• **Actual deduction: 5 points**`
  },

  exampleCalculations: {
    title: "Can you show example score calculations?",
    answer: `**Example 1: Clean Contract**
Starting score: 100
- 0 Critical
- 0 High
- 1 Low (immediate): -2 points
**Final Score: 98 (A+)**

---

**Example 2: Good Contract with Minor Issues**
Starting score: 100
- 0 Critical
- 0 High
- 2 Medium (1 immediate, 1 conditional): -(5 + 3) = -8 points
- 3 Low (theoretical): -(2 × 0.3 × 3) = -1.8 points
**Final Score: 90.2 (A)**

---

**Example 3: Needs Improvements**
Starting score: 100
- 0 Critical
- 1 High (immediate): -12 points
- 2 Medium (1 immediate, 1 theoretical): -(5 + 1.5) = -6.5 points
- 4 Low (mixed): -5 points
**Final Score: 76.5 (C+)**

---

**Example 4: Significant Issues**
Starting score: 100
- 1 Critical (immediate): -25 points
- 2 High (immediate): -24 points
- 3 Medium: -15 points
**Final Score: 36 (F) - DO NOT DEPLOY**`
  },

  gradeScale: {
    title: "What do the letter grades mean?",
    answer: `Grade scale and production readiness:

**A+ (95-100)** - Exceptional Security
✓ Production ready
✓ Best practices followed
✓ Minimal or no issues found
→ Safe to deploy with confidence

**A (90-94)** - Excellent Security
✓ Production ready
✓ Very minor issues only
✓ No significant risks
→ Safe to deploy after addressing minor points

**B (80-89)** - Good Security
✓ Production ready with fixes
⚠ Some issues need attention
✓ No critical vulnerabilities
→ Fix identified issues, then deploy

**C (70-79)** - Acceptable with Improvements
⚠ Additional review recommended
⚠ Multiple medium-severity issues
✓ May be acceptable for low-value contracts
→ Address all medium+ issues before production

**D (60-69)** - Needs Significant Work
❌ NOT production ready
❌ Architectural security gaps
⚠ Multiple concerning issues
→ Requires major fixes before deployment

**F (<60)** - Critical Issues Present
❌ DANGEROUS to deploy
❌ Critical or multiple high-severity vulnerabilities
❌ Significant security problems
→ Complete security overhaul required`
  },

  thirdPartyDependencies: {
    title: "Why are third-party dependent issues scored lower?",
    answer: `**Philosophy**: You shouldn't be heavily penalized for issues that require trusted third-party contracts (like USDC, Chainlink, Uniswap) to be malicious.

**Example Scenario**:
Your vault contract has reentrancy risk IF the USDC token contract becomes malicious.

**Why we discount this**:
1. **Trust Assumptions**: Most DeFi requires trusting certain primitives (stablecoins, oracles, DEXes)
2. **Risk Transfer**: If USDC is compromised, the entire DeFi ecosystem has bigger problems
3. **Not Your Fault**: You can't control third-party contract behavior
4. **Defense in Depth**: We still flag it so you can add guards if desired

**However**: We DO heavily penalize issues in YOUR code that don't require external malice.

**Best Practice**: Document your trust assumptions clearly:
- "This contract assumes USDC is a legitimate ERC-20 token"
- "This contract trusts Chainlink oracles for price feeds"
- "This contract assumes the PSM is non-malicious"

Then users can make informed decisions about your risk profile.`
  },

  upgradeCentralization: {
    title: "Why do upgrade mechanisms affect the score?",
    answer: `**Upgrade mechanisms are scored based on safeguards**:

**Instant Upgrade (No Timelock)** - Penalized
• Admin can upgrade immediately with no warning
• Users have zero time to react
• High centralization risk
→ Medium severity issue: -5 points (immediate)

**24-48 Hour Timelock** - Minor penalty or neutral
• Users can exit before harmful upgrade
• Community can review changes
• Transparency provides safety
→ Low severity issue: -2 points (conditional)

**Multisig + Timelock** - Neutral or bonus
• Requires multiple signers
• Time delay for review
• Best practice for production
→ No penalty

**Governance-Based** - Bonus
• Token holders vote on upgrades
• Fully decentralized
• Maximum transparency
→ Potential +5 point bonus

**Why this matters**: Many projects have been rugged via malicious upgrades. A single admin with instant upgrade capability represents latent rug pull risk, even if the admin is currently honest.

**Recommendation**: Add a 48-hour timelock minimum for any production contract holding user funds.`
  },

  contextMatters: {
    title: "Does contract context affect scoring?",
    answer: `**Yes! Context is important**:

**For Low-Value Contracts**:
A 70% (C) score might be acceptable for:
- Testnet deployments
- Internal tools
- Contracts holding <$10k value
- MVP/experimental features

**For High-Value Contracts**:
You should aim for 90%+ (A) for:
- Mainnet vaults holding user funds
- Token contracts (especially if tradeable)
- Bridge contracts
- Contracts holding >$100k

**For Critical Infrastructure**:
Aim for 95%+ (A+) for:
- Protocols handling >$10M TVL
- Cross-chain bridges
- Stablecoin contracts
- DAO treasury management

**The score reflects security posture, but you decide acceptable risk level based on your use case.**`
  },

  improvingScore: {
    title: "How can I improve my audit score?",
    answer: `**Quick wins to boost your score**:

1. **Add Reentrancy Guards** (+10-15 points typically)
   \`\`\`solidity
   import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
   contract MyVault is ReentrancyGuard {
     function deposit() external nonReentrant { ... }
   }
   \`\`\`

2. **Add Upgrade Timelock** (+5-10 points)
   \`\`\`solidity
   uint256 public upgradeTimelockEnd;
   function proposeUpgrade(address impl) external {
     upgradeTimelockEnd = block.timestamp + 48 hours;
   }
   \`\`\`

3. **Use SafeERC20** (+2-5 points)
   \`\`\`solidity
   import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
   using SafeERC20 for IERC20;
   token.safeTransfer(recipient, amount);
   \`\`\`

4. **Add Input Validation** (+3-8 points)
   \`\`\`solidity
   require(address != address(0), "zero address");
   require(amount > 0, "zero amount");
   \`\`\`

5. **Disclose Admin Controls** (+5-15 points)
   If you answer the pre-audit questionnaire honestly about admin privileges (pause, upgrade, fee changes), we **automatically reduce severity** of related findings because transparency shows good faith.

6. **Write Tests** (+5-10 points)
   Automated test execution can verify vulnerabilities and auto-reduce severity for false positives.`
  },

  fairness: {
    title: "Is the scoring fair and transparent?",
    answer: `**Our commitment to fairness**:

✓ **Transparent Calculations**: Every finding shows its scoring impact
✓ **Context-Aware**: Third-party dependencies get discounted penalties
✓ **Disclosure Rewards**: Honesty in pre-audit questionnaire reduces severity
✓ **Test Verification**: Automated tests can prove false positives
✓ **Explained Deductions**: Each finding shows why it impacts score

**You can see the math**:
Every finding now includes a \`_scoringNote\` field showing:
\`\`\`json
{
  "basePenalty": 5,
  "category": "theoretical",
  "multiplier": 0.3,
  "actualPenalty": 1.5,
  "reason": "Requires third-party contract to be malicious"
}
\`\`\`

**Scoring Philosophy**:
We err on the side of security, but we don't want to unfairly penalize good contracts for theoretical issues requiring external parties to be malicious.

**Still disagree with a finding?**
Use the "Mark Resolved" feature to provide context. Your clarifications can lead to re-analysis and score adjustment.`
  },

  scoringChanges: {
    title: "What changed in the scoring system?",
    answer: `**Recent improvements** (January 2026):

**Before (Too Harsh)**:
- Medium: -8 points (flat)
- Low: -3 points (flat)
- No exploitability consideration
- Third-party risks penalized same as direct issues

**After (More Fair)**:
- Medium: -5 points base, -1.5 if theoretical (70% discount)
- Low: -2 points base, -0.6 if theoretical (70% discount)
- Exploitability categories: Immediate (100%), Conditional (60%), Theoretical (30%)
- Third-party dependent issues significantly discounted

**Real Example Impact**:

UsdcVaultL2 contract:
- 3 Medium (reentrancy requiring PSM/USDC to be malicious)
- 1 Medium (instant upgrade - immediate risk)
- 3 Low (various theoretical issues)

**Old scoring**: 67% (D+)
**New scoring**: ~88% (B)

**Why**: The reentrancy issues require trusted third-party contracts to become malicious, which is a significantly lower real-world risk than the old scoring suggested.`
  }
};

/**
 * Generate markdown FAQ for inclusion in reports
 */
export function generateScoringFAQ(): string {
  const sections = Object.entries(SCORING_FAQ);

  let markdown = `# Audit Scoring & Grading FAQ\n\n`;
  markdown += `*Understanding how your security score is calculated*\n\n`;
  markdown += `---\n\n`;

  for (const [key, section] of sections) {
    markdown += `## ${section.title}\n\n`;
    markdown += `${section.answer}\n\n`;
    markdown += `---\n\n`;
  }

  return markdown;
}

/**
 * Get specific FAQ answer by key
 */
export function getFAQAnswer(key: keyof typeof SCORING_FAQ): string {
  return SCORING_FAQ[key]?.answer || 'FAQ not found';
}
