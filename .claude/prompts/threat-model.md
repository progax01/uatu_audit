# Threat Model Analysis

You are building a comprehensive threat model for the audited smart contracts.

## Input
- Codebase: {{codebase_summary}}
- Findings: {{findings}}
- Architecture: {{architecture}}

## Task
Analyze the smart contract system and identify:
1. Who might attack (Threat Actors)
2. How they might attack (Attack Vectors)
3. What they might target (Assets at Risk)
4. What assumptions must hold for security (Trust Assumptions)

---

## 1. Threat Actors

Identify relevant threat actors from:

| Actor Type | Capabilities | Typical Motivation |
|------------|--------------|-------------------|
| `external_attacker` | Smart contract deployment, flash loan access, capital | Financial gain |
| `malicious_insider` | Internal knowledge, potential key access | Financial gain, sabotage |
| `compromised_admin` | Admin key access, upgrade capabilities | Key theft, social engineering |
| `mev_bot` | Transaction ordering, sandwich attacks | MEV extraction |
| `competitor` | Capital, technical knowledge | Market manipulation, economic warfare |
| `nation_state` | Advanced resources, zero-days | Disruption, theft |

Only include actors relevant to THIS specific protocol.

---

## 2. Attack Vectors

List attack techniques applicable to the findings:

**Smart Contract Attacks:**
- Reentrancy (classic, cross-function, cross-contract)
- Flash Loan attacks
- Front-running / Sandwich attacks
- Price Oracle manipulation
- Integer overflow/underflow
- Access control bypass
- Signature replay

**Economic Attacks:**
- Governance manipulation
- Liquidity attacks
- Arbitrage exploitation

**Infrastructure Attacks:**
- Key compromise
- Social engineering
- DNS hijacking

---

## 3. Assets at Risk

Identify what can be stolen, damaged, or manipulated:
- User funds (deposits, LP tokens)
- Protocol reserves (treasury, fees)
- Governance tokens
- NFTs or other digital assets
- Protocol reputation
- Protocol functionality

---

## 4. Trust Assumptions

List security assumptions that must remain true:
- "Admin keys are held securely"
- "Chainlink oracle is reliable"
- "External protocol (X) is not compromised"
- "Block timestamps are accurate within X seconds"

---

## Output Format
```json
{
  "threat_actors": [
    {
      "type": "external_attacker" | "malicious_insider" | "compromised_admin" | "mev_bot" | "competitor" | "nation_state",
      "capability": "Description of what they can do",
      "motivation": "Why they would attack this protocol"
    }
  ],
  "attack_vectors": [
    "Reentrancy",
    "Flash Loans",
    "Front-running"
  ],
  "assets_at_risk": [
    "User deposits (~$X TVL)",
    "Protocol treasury",
    "Governance tokens"
  ],
  "trust_assumptions": [
    "Admin multisig operates honestly",
    "Chainlink price feeds are accurate",
    "Uniswap V3 pools maintain liquidity"
  ]
}
```

## Example Output
```json
{
  "threat_actors": [
    {
      "type": "external_attacker",
      "capability": "Can deploy malicious contracts, has access to flash loans, understands DeFi protocols",
      "motivation": "Financial gain through exploitation"
    },
    {
      "type": "mev_bot",
      "capability": "Can reorder transactions, execute sandwich attacks, monitor mempool",
      "motivation": "Extract MEV from user transactions"
    },
    {
      "type": "compromised_admin",
      "capability": "Full admin access including upgrades and parameter changes",
      "motivation": "Stolen keys through phishing or key mismanagement"
    }
  ],
  "attack_vectors": [
    "Reentrancy attacks",
    "Flash loan price manipulation",
    "Front-running deposits/withdrawals",
    "Governance vote manipulation",
    "Oracle staleness exploitation"
  ],
  "assets_at_risk": [
    "User deposits in vaults (~$5M TVL)",
    "Protocol fee accumulator (~$100K)",
    "Governance token supply (potential mint vulnerability)"
  ],
  "trust_assumptions": [
    "3-of-5 admin multisig acts honestly",
    "Chainlink ETH/USD feed remains within 1% accuracy",
    "Underlying ERC20 tokens behave per specification",
    "Block timestamps are accurate within 15 minutes"
  ]
}
```
