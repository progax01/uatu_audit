# Oracle Manipulation Detection Methodology

## Overview

Oracle manipulation occurs when attackers exploit price feeds, data sources, or calculation mechanisms to manipulate values used in critical operations (lending, swaps, liquidations).

## Attack Vectors

### 1. Flash Loan Price Manipulation

**Pattern:**
```solidity
// Vulnerable: Spot price from AMM
function getPrice() public view returns (uint256) {
    uint256 reserve0 = pair.balanceOf(token0);
    uint256 reserve1 = pair.balanceOf(token1);
    return reserve1 * 1e18 / reserve0; // Easily manipulated
}

function liquidate(address user) external {
    uint256 price = getPrice(); // Manipulated price
    uint256 collateralValue = userCollateral[user] * price;
    // Liquidation logic using manipulated price
}
```

**Attack Flow:**
1. Attacker takes flash loan
2. Swaps large amount in AMM pool
3. Price drastically changes
4. Calls vulnerable function with manipulated price
5. Profits from manipulation
6. Repays flash loan

**Detection:**
- Spot price queries from AMM pools
- No time-weighted average (TWAP)
- Single block price usage
- No price freshness checks

### 2. TWAP Manipulation

**Pattern:**
```solidity
// Vulnerable: Short TWAP window
function getTWAP() public view returns (uint256) {
    uint256 price0 = oracle.getPrice(block.timestamp - 10 minutes);
    uint256 price1 = oracle.getPrice(block.timestamp);
    return (price0 + price1) / 2; // 10-minute window too short
}
```

**Attack:**
- Attacker manipulates price for duration of TWAP window
- Requires sustained manipulation (harder than flash loan)
- Still possible with sufficient capital

**Detection:**
- TWAP window < 30 minutes
- Insufficient data points
- No outlier detection

### 3. Oracle Staleness

**Pattern:**
```solidity
// Vulnerable: No freshness check
function getPrice() public view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    return uint256(price); // No timestamp validation
}
```

**Issues:**
- Oracle stops updating (Chainlink node failure)
- Stale price used for hours/days
- Enables arbitrage or unfair liquidations

**Detection:**
- No `updatedAt` timestamp check
- Missing staleness threshold
- No circuit breaker for stale data

### 4. Chainlink Oracle Misuse

**Pattern:**
```solidity
// Vulnerable: Multiple issues
function getPrice() public view returns (uint256) {
    (, int256 price,,,) = priceFeed.latestRoundData();
    // Issues:
    // 1. No validation that price > 0
    // 2. No staleness check
    // 3. No answeredInRound validation
    // 4. Assumes 18 decimals (might be 8)
    return uint256(price);
}
```

**Proper Usage:**
```solidity
function getPrice() public view returns (uint256) {
    (
        uint80 roundId,
        int256 price,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();

    require(price > 0, "Invalid price");
    require(answeredInRound >= roundId, "Stale price");
    require(updatedAt > block.timestamp - 3600, "Price too old");

    uint8 decimals = priceFeed.decimals();
    return uint256(price) * 1e18 / (10 ** decimals);
}
```

### 5. Read-Only Reentrancy in Oracles

**Pattern:**
```solidity
// Vulnerable vault
function getPricePerShare() public view returns (uint256) {
    return totalAssets() * 1e18 / totalSupply();
}

function withdraw() external {
    uint256 shares = balanceOf[msg.sender];
    balanceOf[msg.sender] = 0;

    uint256 assets = shares * totalAssets() / totalSupply();
    asset.transfer(msg.sender, assets); // External call

    _burn(msg.sender, shares); // State update after
}

// Attacker exploits
contract Attacker {
    function attack() external {
        vault.withdraw();
    }

    receive() external payable {
        // During external call, totalSupply not yet updated
        uint256 manipulatedPrice = vault.getPricePerShare();
        // Use manipulated price in other protocol
        otherProtocol.exploit(manipulatedPrice);
    }
}
```

**Detection:**
- View functions called during state transitions
- Balances read before updates complete
- Other protocols depend on view function

## Detection Algorithm

### Step 1: Identify Price Sources
- Chainlink oracles
- Uniswap/Sushiswap pools
- Custom oracle contracts
- Band Protocol
- Pyth Network
- API3

### Step 2: Validate Oracle Usage
```
For each price source:
  ✓ Freshness check (updatedAt)
  ✓ Price sanity check (price > 0)
  ✓ Decimal handling
  ✓ Round validation (Chainlink)
  ✓ Fallback oracle
  ✓ Circuit breaker
```

### Step 3: Check Manipulation Resistance
- Is price from spot or TWAP?
- Can price be manipulated in single transaction?
- Is TWAP window sufficient (>30 min)?
- Are multiple sources aggregated?

### Step 4: Analyze Price Impact
- Where is price used (liquidations, swaps, minting)?
- What's the economic impact of 10% manipulation?
- Are there sanity bounds on prices?

## Chain-of-Thought Template

```json
{
  "step": "Analyzing price oracle in liquidation function",
  "observation": "Line 67: uint256 price = uniswapPair.reserve1() / uniswapPair.reserve0() - spot price from single pool",
  "hypothesis": "Flash loan attack possible - attacker can manipulate spot price in single transaction",
  "validation": [
    "No TWAP usage",
    "Single pool as price source",
    "Price used in liquidation threshold calculation",
    "Flash loans available on this chain (Aave, dYdX)",
    "Similar attack seen in bZx hack (2020)"
  ],
  "conclusion": "CRITICAL: Flash loan price manipulation enables unfair liquidations and fund drain",
  "confidence": 0.96,
  "economic_impact": "Attacker can liquidate all positions with >$1M profit per attack"
}
```

## Test Generation

### Foundry Test Template
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vault.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

contract OracleManipulationTest is Test {
    Vault public vault;
    IUniswapV2Pair public pair;
    FlashLoanProvider public flashLoan;

    function setUp() public {
        vault = new Vault();
        pair = IUniswapV2Pair(vault.priceFeed());
        flashLoan = new FlashLoanProvider();

        // Setup initial liquidity
        deal(address(token0), address(pair), 1000 ether);
        deal(address(token1), address(pair), 2000 ether);
    }

    function testFlashLoanPriceManipulation() public {
        // Record initial price
        uint256 priceBeforeAttack = vault.getPrice();

        // Execute flash loan attack
        flashLoan.flashLoan(1000 ether, address(this));

        // Verify price was manipulated
        uint256 priceDuringAttack = vault.getPrice();
        assertGt(priceDuringAttack, priceBeforeAttack * 2, "Price should double");

        // Show economic impact
        uint256 profit = vault.calculateExploitProfit();
        assertGt(profit, 100 ether, "Profitable attack");

        console.log("Price before:", priceBeforeAttack);
        console.log("Price during:", priceDuringAttack);
        console.log("Attacker profit:", profit);
    }

    function onFlashLoan(uint256 amount) external {
        // Manipulate price via large swap
        token0.transfer(address(pair), amount);
        pair.swap(0, amount * 2, address(this), "");

        // Exploit with manipulated price
        vault.exploitWithManipulatedPrice();

        // Repay flash loan
        token1.transfer(address(flashLoan), amount);
    }
}
```

## Remediation Patterns

### 1. Use Chainlink with Proper Validation
```solidity
function getPrice() public view returns (uint256) {
    (
        uint80 roundId,
        int256 price,
        ,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();

    require(price > 0, "Invalid price");
    require(answeredInRound >= roundId, "Stale price");
    require(block.timestamp - updatedAt < STALENESS_THRESHOLD, "Price outdated");

    return uint256(price);
}
```

### 2. Use TWAP with Sufficient Window
```solidity
function getTWAP() public view returns (uint256) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = 3600; // 1 hour ago
    secondsAgos[1] = 0;     // now

    (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);

    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 tick = int24(tickCumulativesDelta / 3600);

    return OracleLibrary.getQuoteAtTick(tick, 1e18, token0, token1);
}
```

### 3. Use Multiple Oracle Sources
```solidity
function getPrice() public view returns (uint256) {
    uint256 chainlinkPrice = getChainlinkPrice();
    uint256 uniswapPrice = getUniswapTWAP();
    uint256 bandPrice = getBandPrice();

    // Ensure prices are within acceptable variance
    require(
        isWithinDeviation(chainlinkPrice, uniswapPrice, 5),
        "Price deviation too high"
    );

    return (chainlinkPrice + uniswapPrice + bandPrice) / 3;
}
```

## Historical Examples

- **bZx (2020)**: $954K stolen via flash loan manipulation
- **Harvest Finance (2020)**: $24M stolen via price manipulation
- **Cream Finance (2021)**: $130M stolen via oracle exploit
- **Mango Markets (2022)**: $110M stolen via oracle manipulation

## References

- [Euler Finance: Oracle Rating Guide](https://docs.euler.finance/security/oracle-rating/)
- [Chainlink Best Practices](https://docs.chain.link/data-feeds/using-data-feeds)
- [samczsun: So you want to use a price oracle](https://samczsun.com/so-you-want-to-use-a-price-oracle/)
