# Halborn ZKCross Audit Report - Line by Line Analysis

**Source:** https://www.halborn.com/audits/zkcross/evm-stellar-zkcrossdex-5ec240
**Analyzed by:** UatuAudit
**Date:** 2025-12-03

---

## 1. Executive Summary - Kya Ho Raha Hai?

**Audit Details:**
- **Auditor:** Halborn (reputed blockchain security firm)
- **Client:** ZKCross
- **Contract:** Solidity-based EVM Swapper smart contract
- **Commit Reviewed:** `0264b30`
- **Duration:** August 21-22, 2025 (2 days audit)
- **File:** `contracts/Swapper.sol`

**Summary:** Ye ek cross-chain DEX (Decentralized Exchange) hai jo EVM aur Stellar blockchain ke beech swap enable karta hai. Halborn ne code review kiya aur kuch vulnerabilities find ki, jo ZKCross team ne fix kar di.

---

## 2. Scope - Kya Check Hua?

| Item | Detail |
|------|--------|
| **Repo** | https://github.com/Dev-zkCross/EVM_Stellar_zkCrossDex |
| **Commit** | `0264b3082a5b080d7e4b04256724255ed60b191a` |
| **In Scope** | `contracts/Swapper.sol` |
| **Out of Scope** | Third-party dependencies, Economic attacks |

**Note:** Sirf `Swapper.sol` audit hua - matlab agar koi vulnerability third-party library (like OpenZeppelin) mein hai, toh wo check nahi hui.

---

## 3. Assessment Methodology - Kaise Check Hua?

Halborn ne 5-layer approach use kiya:

1. **Reconnaissance** - Contract ka purpose aur use cases samjhe
2. **Manual Code Review** - Privilege boundaries aur fund flows manually check kiye
3. **Static Analysis** - Automated tools se code scan kiya
4. **Dynamic Testing** - On-chain test suites run kiye
5. **Transaction Simulation** - External tokens ke saath integration test kiya

---

## 4. Findings - Kya Vulnerabilities Mili?

### Finding #1: Third-party Can Trigger Swap on Behalf of User

| Attribute | Value |
|-----------|-------|
| **Severity** | MEDIUM (BVSS: 5.86) |
| **Status** | SOLVED |
| **Fix Commit** | `268595f7` |

**Problem Kya Tha:**
```
User A ne Swapper contract ko token approval diya
Attacker B ne swap function call kiya User A ki taraf se
User A ke tokens swap ho gaye bina uski permission ke!
```

**Root Cause:** `swap()` function mein check nahi tha ki caller hi wo hai jiske funds use ho rahe hain.

**Attack Scenario:**
```
1. Alice approves Swapper for 1000 USDC
2. Alice intends to swap later
3. Bob (attacker) calls swap(Alice, ...)
4. Alice's 1000 USDC gets swapped without her consent
5. Bob benefits from MEV or receives output tokens
```

**Fix:** Caller verification add kiya - `require(msg.sender == user, "Not authorized")`

---

### Finding #2: Funds Stuck for Smart Contract Recipients

| Attribute | Value |
|-----------|-------|
| **Severity** | MEDIUM (BVSS: 5.00) |
| **Status** | SOLVED |
| **Fix Commit** | `268595f7` |

**Problem Kya Tha:**
```solidity
// OLD CODE (Vulnerable)
payable(recipient).transfer(amount);  // Only 2300 gas!
```

**Issue:** `.transfer()` sirf 2300 gas deta hai. Agar recipient ek smart contract hai with complex `receive()` function, toh transaction fail ho jayegi aur funds stuck!

**Example Scenario:**
```
1. User wants to receive ETH in their Gnosis Safe wallet
2. Gnosis Safe has custom receive() logic
3. transfer() fails due to 2300 gas limit
4. User's ETH stuck in Swapper contract forever!
```

**Fix:**
```solidity
// NEW CODE (Safe)
(bool ok, ) = payable(recipient).call{value: amount}("");
require(ok, "ETH send failed");
```

`.call()` forwards all available gas, allowing complex contracts to receive funds.

---

### Finding #3: No Slippage Control in Swap

| Attribute | Value |
|-----------|-------|
| **Severity** | LOW (BVSS: 3.35) |
| **Status** | SOLVED |
| **Fix Commit** | `268595f7` |

**Problem Kya Tha:**
```
lock() function → has minAmountOut ✓
release() function → has minAmountOut ✓
swap() function → NO minAmountOut ✗
```

**Issue:** Without slippage protection, users are vulnerable to:
- **MEV Attacks:** Bots can sandwich attack transactions
- **Price Volatility:** Price change between tx submission and execution

**Attack Scenario (Sandwich Attack):**
```
1. User submits swap: 1000 USDC → ETH (expects ~0.5 ETH)
2. Bot sees pending tx in mempool
3. Bot front-runs: Buys ETH, price goes up
4. User's tx executes: Gets only 0.45 ETH (worse price)
5. Bot back-runs: Sells ETH at higher price
6. Bot profits, User loses ~10%
```

**Fix:** Add `minAmountOut` parameter to `swap()`:
```solidity
function swap(..., uint256 minAmountOut) {
    // ... swap logic ...
    require(amountOut >= minAmountOut, "Slippage exceeded");
}
```

---

### Finding #4: Fee-on-Transfer Token Incompatibility

| Attribute | Value |
|-----------|-------|
| **Severity** | LOW (BVSS: 2.51) |
| **Status** | SOLVED |
| **Fix Commit** | `268595f7` |

**Problem Kya Tha:**

Kuch tokens (like SAFEMOON, PAXG) har transfer pe fee deduct karte hain.

**Example:**
```
User sends: 1000 SAFEMOON
Fee: 10% (100 tokens)
Contract receives: 900 SAFEMOON
Contract approves: 1000 SAFEMOON (wrong!)
```

**Issue:** Contract nominal amount (1000) approve karta hai, but actual amount kam hai (900). Subsequent operations fail!

**Fix:**
```solidity
// Measure actual received amount
uint256 balanceBefore = token.balanceOf(address(this));
token.transferFrom(user, address(this), amount);
uint256 balanceAfter = token.balanceOf(address(this));
uint256 actualReceived = balanceAfter - balanceBefore;

// Approve actual amount, not nominal
token.approve(allowanceHolder, actualReceived);
```

---

### Finding #5: Missing Two-Step Ownership Transfer

| Attribute | Value |
|-----------|-------|
| **Severity** | LOW (BVSS: 2.50) |
| **Status** | SOLVED |
| **Fix Commit** | `268595f7` |

**Problem Kya Tha:**

Single-step ownership transfer risky hai:
```solidity
// ONE STEP (Dangerous)
function transferOwnership(address newOwner) {
    owner = newOwner;  // What if newOwner is wrong address?
}
```

**Risk Scenarios:**
1. Typo in address → Ownership lost forever
2. Wrong address pasted → Contract becomes ownerless
3. No way to recover!

**Fix - Two-Step Transfer:**
```solidity
// STEP 1: Owner proposes new owner
function transferOwnership(address newOwner) {
    pendingOwner = newOwner;
}

// STEP 2: New owner must accept
function acceptOwnership() {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
}
```

Use `Ownable2StepUpgradeable` from OpenZeppelin.

---

### Finding #6: User Funds Stuck Without Recourse on Failed Cross-Chain Transfer

| Attribute | Value |
|-----------|-------|
| **Severity** | MEDIUM-HIGH |
| **Status** | SOLVED |
| **Fix Commits** | `1aaaf2c`, `0815688` |

**Problem Kya Tha:**

Ye sabse critical issue tha!

**Flow:**
```
1. User calls lock() on EVM chain
2. Tokens transferred to bridge admin immediately
3. Cross-chain message sent to Stellar
4. If Stellar side fails → USER'S FUNDS LOST!
```

**Issue:** No on-chain recovery mechanism. Agar cross-chain operation fail hota, user ke paas koi recourse nahi tha.

**Real World Scenario:**
```
1. Alice locks 10,000 USDC on Ethereum
2. Funds go to bridge admin
3. Stellar network is congested, tx fails
4. Alice's 10,000 USDC stuck with bridge admin
5. No automated way to refund!
```

**Fix - Claims Layer Implementation:**

ZKCross ne comprehensive solution implement kiya:

1. **Configurable Deadlines** - Agar cross-chain tx X time mein complete nahi, claim available
2. **Admin Acknowledgement** - Admin must explicitly confirm successful transfer
3. **ERC20 Refund Mechanism** - Admin can initiate refunds for failed transfers
4. **USDC-only Refunds** - All tokens converted to USDC during lock, simplifying refunds
5. **Support Ticket System** - Off-chain backup for edge cases

---

## 5. Overall Assessment

### Severity Distribution:

```
CRITICAL  : 0
HIGH      : 0
MEDIUM    : 3 (Finding 1, 2, 6)
LOW       : 3 (Finding 3, 4, 5)
INFO      : 0
```

### Key Observations:

1. **No Critical Issues** - Good baseline security
2. **All Fixed** - ZKCross addressed every finding
3. **Quick Turnaround** - All fixes in single commit `268595f7`
4. **Cross-chain Risk** - Finding #6 shows inherent bridge risks

---

## 6. Lessons Learned

### For Developers:

| Issue | Prevention |
|-------|------------|
| Authorization bypass | Always verify `msg.sender` matches affected user |
| Gas stipend issues | Use `.call()` instead of `.transfer()` |
| Slippage attacks | Add `minAmountOut` to all swap functions |
| Fee-on-transfer | Measure actual balance change, not nominal |
| Ownership loss | Use 2-step ownership transfer |
| Cross-chain failures | Implement timeout + refund mechanism |

### Common Patterns to Avoid:

```solidity
// BAD: No caller verification
function swap(address user, ...) public {
    // Anyone can call for any user!
}

// BAD: Fixed gas stipend
payable(to).transfer(amount);

// BAD: No slippage protection
uint256 out = dex.swap(tokenIn, tokenOut, amountIn);
// out could be anything!

// BAD: Nominal amount for fee tokens
token.transferFrom(user, address(this), amount);
token.approve(spender, amount);  // Wrong if fee deducted!
```

---

## 7. Additional Notes

**Residual Risk Identified:**

> "The _approve helper function pattern review identified residual approval risks from incomplete allowance revocation after swaps and between allowanceHolder updates"

**Meaning:** Agar swap ke baad ya allowanceHolder change hone pe purane approvals properly revoke nahi hue, toh residual approval attack possible hai. Ye finding detail mein document nahi hui, but awareness ke liye mention hai.

---

## 8. Conclusion

**Audit Quality:** Good - Halborn ne comprehensive review kiya
**Client Response:** Excellent - ZKCross ne sab fix kiya
**Contract Safety:** Post-fix, contract reasonably secure hai

**Remaining Considerations:**
- Third-party dependency risks (out of scope)
- Economic attack vectors (out of scope)
- Residual approval risks (mentioned but not detailed)

---

*This analysis is for educational purposes. Always conduct independent security reviews before interacting with any smart contract.*
