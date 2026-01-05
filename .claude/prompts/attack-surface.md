# Attack Surface Analysis

You are mapping the attack surface of smart contracts to identify all potential entry points.

## Input
- Contract Files: {{contract_files}}
- Function Signatures: {{functions}}
- Inheritance Tree: {{inheritance}}

## Task
Systematically identify and categorize all potential attack entry points.

---

## 1. External Entry Points

All `public` and `external` functions that can be called by anyone (no access control).

**Look for:**
- Functions without `onlyOwner`, `onlyAdmin`, or role modifiers
- Functions that accept user input
- Functions that move funds
- Functions that change state

---

## 2. Privileged Functions

Functions with access control that only specific roles can call.

**Categorize by role:**
- Owner functions
- Admin functions
- Operator functions
- Minter/Burner functions
- Pauser functions
- Upgrader functions

**Risk consideration:** What damage can each role do if compromised?

---

## 3. External Calls

All calls to external contracts (potential callback points, reentrancy vectors).

**Identify:**
- ERC20 transfers (safeTransfer, transfer)
- Low-level calls (call, delegatecall, staticcall)
- Interface calls to external protocols
- Oracle calls

---

## 4. Function Counts

Quantify the attack surface:
- State-modifying functions (not view/pure)
- Payable functions (accept ETH)
- View/pure functions (read-only)

---

## Output Format
```json
{
  "external_entry_points": {
    "count": 15,
    "functions": [
      "deposit(uint256 amount)",
      "withdraw(uint256 amount)",
      "swap(address tokenIn, address tokenOut, uint256 amountIn)"
    ]
  },
  "privileged_functions": {
    "count": 8,
    "functions": [
      "setFee(uint256 newFee)",
      "pause()",
      "unpause()",
      "upgradeTo(address newImplementation)"
    ],
    "roles": ["owner", "admin", "operator"]
  },
  "external_calls": {
    "count": 12,
    "targets": [
      "IERC20 (transfer, transferFrom)",
      "IUniswapV2Router (swapExactTokensForTokens)",
      "IChainlinkAggregator (latestRoundData)"
    ]
  },
  "state_modifying_functions": 23,
  "payable_functions": 4
}
```

## Example Output
```json
{
  "external_entry_points": {
    "count": 7,
    "functions": [
      "deposit(uint256)",
      "withdraw(uint256)",
      "withdrawAll()",
      "claimRewards()",
      "stake(uint256)",
      "unstake(uint256)",
      "compound()"
    ]
  },
  "privileged_functions": {
    "count": 5,
    "functions": [
      "setRewardRate(uint256) - onlyOwner",
      "pause() - onlyOwner",
      "unpause() - onlyOwner",
      "setWhitelist(address,bool) - onlyAdmin",
      "emergencyWithdraw() - onlyOwner"
    ],
    "roles": ["owner", "admin"]
  },
  "external_calls": {
    "count": 8,
    "targets": [
      "IERC20.transfer() - 3 calls",
      "IERC20.transferFrom() - 2 calls",
      "IOracle.getPrice() - 2 calls",
      "IRouter.swap() - 1 call"
    ]
  },
  "state_modifying_functions": 12,
  "payable_functions": 2
}
```

## Analysis Guidelines
1. **High Risk Entry Points:** payable + state-modifying + no access control
2. **Medium Risk:** State-modifying + no access control
3. **External Call Risk:** Any call before state update = reentrancy vector
4. **Privileged Function Risk:** Assess damage if role is compromised
