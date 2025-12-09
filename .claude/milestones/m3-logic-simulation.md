# Milestone 3: Deep Logic Simulation

## Objective

Use Chain-of-Thought reasoning to simulate complex attack scenarios, detect multi-step vulnerabilities, and analyze business logic flaws that static analysis cannot catch.

## Tasks

### 1. Trace Critical Execution Paths
- Deposit → Withdraw flows
- Mint → Burn flows
- Borrow → Repay → Liquidate flows
- State transitions
- Cross-contract interactions

### 2. Simulate Attacker Scenarios

#### Web3 Attack Simulations
- **Reentrancy**: Can attacker re-enter during external calls?
- **Flash Loan Attacks**: Can attacker manipulate state with borrowed funds?
- **Oracle Manipulation**: Can price feeds be manipulated?
- **Front-Running**: Can attacker profit from transaction ordering?
- **Sandwich Attacks**: Can attacker exploit DEX slippage?
- **Governance Attacks**: Can attacker manipulate voting?
- **Cross-Function Reentrancy**: Can attacker exploit shared state?
- **Read-Only Reentrancy**: Can view functions return manipulated data?

#### Backend Attack Simulations
- **Race Conditions**: Can concurrent requests exploit state?
- **TOCTOU**: Time-of-check vs time-of-use issues
- **Business Logic Bypass**: Can workflow be circumvented?
- **Integer Overflow**: Can mathematical operations overflow?
- **Authentication Bypass**: Can auth be circumvented?
- **Authorization Bypass**: Can privilege escalation occur?
- **Session Fixation**: Can sessions be hijacked?

#### Frontend Attack Simulations
- **State Manipulation**: Can Redux/Context be tampered with?
- **Client-Side Bypass**: Can auth checks be skipped?
- **Prototype Pollution**: Can __proto__ be manipulated?
- **PostMessage Exploits**: Can cross-origin messages be forged?

### 3. Analyze Invariants
For each critical operation, verify:
- Pre-conditions (what must be true before)
- Post-conditions (what must be true after)
- Invariants (what must always be true)

Example:
```
Operation: withdraw(amount)
Pre: balance[user] >= amount
Post: balance[user] == old_balance - amount
Invariant: totalSupply == sum(all balances)
```

Check if invariants can be broken.

### 4. Cross-Contract Analysis
- Trace calls across multiple contracts
- Identify composability risks
- Check for circular dependencies
- Analyze trust assumptions

### 5. Economic Attack Analysis
- Can attacker profit from exploiting this?
- What's the economic incentive?
- What's the minimum capital required?
- What's the maximum extractable value (MEV)?

## Chain-of-Thought Structure

For complex vulnerabilities, use structured reasoning:

```json
{
  "finding_id": "LOGIC-001",
  "reasoning_steps": [
    {
      "step": 1,
      "action": "Map the borrow() function call graph",
      "observation": "borrow() → updateInterest() → oracle.getPrice() → vault.balanceOf()",
      "finding": "oracle.getPrice() reads from Uniswap pool spot price"
    },
    {
      "step": 2,
      "action": "Simulate flash loan attack",
      "observation": "Attacker can borrow 100M tokens from Aave, swap in Uniswap pool",
      "finding": "Pool ratio changes dramatically (reserve0/reserve1)"
    },
    {
      "step": 3,
      "action": "Calculate price manipulation impact",
      "observation": "Price increases 5x during attack transaction",
      "finding": "Collateral value artificially inflated"
    },
    {
      "step": 4,
      "action": "Trace borrow limit calculation",
      "observation": "Max borrow = collateralValue * 0.8 / price",
      "finding": "Manipulated price allows borrowing 5x more than intended"
    },
    {
      "step": 5,
      "action": "Verify attack profitability",
      "observation": "Attacker borrows $500K with $100K collateral (should be $80K max)",
      "finding": "Net profit: $420K - flash loan fees ($1K) = $419K profit"
    }
  ],
  "conclusion": {
    "vulnerability": "Flash loan price manipulation",
    "severity": "CRITICAL",
    "confidence": 0.96,
    "attack_vector": "1. Flash loan 100M tokens\n2. Swap to manipulate Uniswap price\n3. Call borrow() with inflated collateral value\n4. Drain protocol funds\n5. Repay flash loan",
    "economic_impact": "$419K profit per attack, unlimited repetition",
    "affected_functions": ["borrow()", "getPrice()", "calculateCollateral()"],
    "root_cause": "Oracle uses spot price instead of TWAP"
  }
}
```

## Detection Methodologies to Apply

Reference these methodology files:
- `reentrancy.md` - For reentrancy detection
- `oracle-manipulation.md` - For price oracle issues
- `access-control.md` - For authorization bypasses
- `injection.md` - For injection attacks

## Output Format

```json
{
  "milestone": 3,
  "status": "complete",
  "findings": [
    {
      "id": "LOGIC-001",
      "severity": "CRITICAL",
      "confidence": 0.96,
      "category": "Oracle Manipulation",
      "title": "Flash Loan Price Manipulation Enables Over-Borrowing",
      "location": {
        "file": "src/LendingPool.sol",
        "function": "borrow()",
        "line": 123
      },
      "attack_vector": "Multi-step attack detailed above",
      "economic_impact": "$419K profit per attack",
      "affected_contracts": ["LendingPool.sol", "Oracle.sol"],
      "reasoning": "Detailed CoT reasoning from above",
      "recommendation": "Replace spot price with Chainlink oracle + TWAP",
      "references": ["bZx hack (2020)", "Harvest Finance hack (2020)"]
    }
  ],
  "simulation_summary": {
    "attack_scenarios_tested": 25,
    "profitable_attacks": 3,
    "invariants_checked": 15,
    "invariants_broken": 2,
    "cross_contract_paths_analyzed": 8
  }
}
```

## Quality Checks

- [ ] All critical paths simulated
- [ ] Attacker perspective taken (not just defender)
- [ ] Economic incentives calculated
- [ ] Multi-step attacks considered
- [ ] Cross-contract interactions analyzed
- [ ] Invariants validated
- [ ] Confidence scores assigned

## Time Estimate

- Small project: 15-30 minutes
- Medium project: 30-60 minutes
- Large project: 1-2 hours

## Notes

- This is the MOST IMPORTANT milestone for finding critical vulnerabilities
- Take time to THINK DEEPLY about attack scenarios
- Ask: "How would I exploit this as an attacker?"
- Consider economic incentives, not just technical feasibility
- Look for multi-step attacks that combine multiple issues
- Reference historical hacks and attack patterns
