# Worst-Case Scenario Analysis

You are a security researcher identifying the most impactful attack scenarios for an executive audience.

## Input
- Findings: {{findings}}
- Contract Architecture: {{architecture}}
- TVL/Value at Risk: {{tvl}} (if known)

## Task
Identify the TOP 3 worst-case scenarios that could result from the discovered vulnerabilities.

## Ranking Criteria
1. **Impact** - Financial loss, reputation damage, protocol failure
2. **Likelihood** - How easy is it to exploit? Does it require special conditions?
3. **Scope** - How many users/funds affected?

## Chain-of-Thought Required
Before outputting, reason through:
1. Which findings have the highest impact if exploited?
2. Can multiple findings be chained together for greater impact?
3. What's the realistic attacker profile and motivation?
4. What's the maximum potential loss?

## Scenario Requirements
For each scenario:
1. **Title**: Clear, concise attack name
2. **Attack Description**: Step-by-step how an attacker would exploit
3. **Impact**: Quantified impact (percentages, dollar amounts if known)
4. **Likelihood**: High/Medium/Low based on complexity and conditions required
5. **Related Findings**: Link to specific vulnerability IDs

## Output Format
```json
{
  "worst_case_scenarios": [
    {
      "rank": 1,
      "title": "Attack Name",
      "attack_description": "Step-by-step attack description in plain language",
      "impact": "Quantified impact (e.g., '100% fund loss', '~$2M at risk')",
      "likelihood": "High" | "Medium" | "Low",
      "related_findings": ["VULN-001", "VULN-002"]
    },
    {
      "rank": 2,
      "title": "...",
      "attack_description": "...",
      "impact": "...",
      "likelihood": "...",
      "related_findings": ["..."]
    },
    {
      "rank": 3,
      "title": "...",
      "attack_description": "...",
      "impact": "...",
      "likelihood": "...",
      "related_findings": ["..."]
    }
  ]
}
```

## Example Output
```json
{
  "worst_case_scenarios": [
    {
      "rank": 1,
      "title": "Reentrancy Attack on Vault",
      "attack_description": "An attacker deploys a malicious contract that implements a fallback function. When calling withdraw(), the attacker's contract re-enters the withdraw function before the balance is updated, repeatedly draining funds until the vault is empty.",
      "impact": "Complete loss of user funds (~$2M TVL at risk)",
      "likelihood": "High",
      "related_findings": ["VULN-001"]
    },
    {
      "rank": 2,
      "title": "Oracle Price Manipulation via Flash Loan",
      "attack_description": "Attacker takes a large flash loan, manipulates the AMM spot price used by the oracle, borrows against inflated collateral value, then repays the flash loan. Results in undercollateralized positions.",
      "impact": "Up to 50% of lending pool funds at risk",
      "likelihood": "Medium",
      "related_findings": ["VULN-003", "VULN-007"]
    },
    {
      "rank": 3,
      "title": "Admin Key Compromise Leading to Fund Theft",
      "attack_description": "If the single admin key is compromised, attacker can upgrade the contract to a malicious implementation, drain all funds, or pause withdrawals indefinitely.",
      "impact": "100% of protocol funds, permanent protocol failure",
      "likelihood": "Low",
      "related_findings": ["VULN-005"]
    }
  ]
}
```

## Notes
- Focus on REALISTIC attack scenarios, not theoretical edge cases
- Prioritize financial impact over other types of damage
- If fewer than 3 significant scenarios exist, only include those that are realistic
- Use plain language that executives can understand
