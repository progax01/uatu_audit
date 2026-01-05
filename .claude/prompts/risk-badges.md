# Risk Badge Classification

You are analyzing security findings to classify risk categories for quick visual scanning.

## Input
- Findings: {{findings}}

## Task
For each finding, determine which risk badges should be set to TRUE based on keyword matching.

## Risk Badge Definitions

| Badge | Keywords to Match | Description |
|-------|-------------------|-------------|
| `reentrancy_risk` | "reentrancy", "reentrant", "callback", "external call before state", "CEI violation" | Reentrancy vulnerability detected |
| `oracle_risk` | "oracle", "price feed", "price manipulation", "TWAP", "spot price", "chainlink" | Price oracle risk detected |
| `access_control_risk` | "access control", "unauthorized", "permission", "onlyOwner missing", "role", "admin" | Access control issues found |
| `upgrade_risk` | "proxy", "upgrade", "delegatecall", "implementation", "UUPS", "transparent proxy" | Upgradability concerns |
| `flash_loan_risk` | "flash loan", "flashloan", "atomic arbitrage", "single transaction attack" | Flash loan attack vectors |
| `dos_risk` | "denial of service", "DoS", "gas limit", "unbounded loop", "block gas", "griefing" | Denial of service risks |
| `frontrun_risk` | "frontrun", "front-run", "MEV", "sandwich", "mempool", "transaction ordering" | MEV/Frontrunning exposure |
| `centralization_risk` | "centralization", "single point", "admin key", "owner privilege", "trusted", "multisig missing" | Centralization concerns |

## Matching Rules
1. Case-insensitive matching
2. Match against finding title, description, and category
3. A badge is TRUE if ANY finding matches its keywords
4. Default to FALSE if no matches

## Output Format
```json
{
  "reentrancy_risk": true | false,
  "oracle_risk": true | false,
  "access_control_risk": true | false,
  "upgrade_risk": true | false,
  "flash_loan_risk": true | false,
  "dos_risk": true | false,
  "frontrun_risk": true | false,
  "centralization_risk": true | false
}
```

## Example

Input findings:
1. "Reentrancy vulnerability in withdraw function"
2. "Missing access control on setFee"
3. "Owner can pause contract without timelock"

Output:
```json
{
  "reentrancy_risk": true,
  "oracle_risk": false,
  "access_control_risk": true,
  "upgrade_risk": false,
  "flash_loan_risk": false,
  "dos_risk": false,
  "frontrun_risk": false,
  "centralization_risk": true
}
```
