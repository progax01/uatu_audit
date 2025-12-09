# Milestone 1: Context Ingestion

## Objective

Read and understand the entire codebase, project structure, dependencies, and build a comprehensive mental model of the system architecture.

## Tasks

### 1. Read All Source Files
- Read every file in scope
- Understand language/framework (Solidity, TypeScript, Python, etc.)
- Identify entry points and critical paths
- Build file dependency graph

### 2. Analyze Project Structure
- Framework detection (Hardhat, Foundry, Next.js, Django, etc.)
- Build system (package.json, requirements.txt, foundry.toml)
- Configuration files (.env templates, config files)
- Test files (understand test coverage)

### 3. Map External Dependencies
- Smart contract imports (OpenZeppelin, etc.)
- npm/pip packages and versions
- External API integrations
- Third-party services (oracles, APIs)

### 4. Identify Audit Scope
- Which files are in scope?
- Which contracts are upgradeable?
- Which functions are public/external?
- What are the trust boundaries?

### 5. Understand Business Logic
- What is the core purpose of this system?
- What are the critical operations (deposit, withdraw, transfer)?
- What assets are at risk?
- What are the access control requirements?

## Output Format

```json
{
  "milestone": 1,
  "status": "complete",
  "summary": {
    "files_analyzed": 47,
    "contracts_found": 12,
    "external_dependencies": ["@openzeppelin/contracts", "@chainlink/contracts"],
    "frameworks_detected": ["Foundry", "Hardhat"],
    "primary_language": "Solidity ^0.8.0",
    "audit_scope": "All contracts in src/ excluding mocks/"
  },
  "architecture_overview": "DeFi lending protocol with isolated lending pools...",
  "critical_paths": [
    {
      "operation": "deposit",
      "files": ["LendingPool.sol", "TokenManager.sol"],
      "risk_level": "high"
    },
    {
      "operation": "borrow",
      "files": ["LendingPool.sol", "Oracle.sol", "InterestRateModel.sol"],
      "risk_level": "critical"
    }
  ],
  "external_integrations": [
    {
      "name": "Chainlink Price Feed",
      "contract": "0x...",
      "purpose": "Asset price oracle",
      "risk": "Price manipulation if oracle fails"
    }
  ],
  "context_cached": true,
  "ready_for_analysis": true
}
```

## Chain-of-Thought Requirements

Document your understanding:

```json
{
  "reasoning": {
    "step": "Reading project structure",
    "observation": "Found 12 contracts, 8 are in src/core/, 4 are periphery. Main entry point is LendingPool.sol",
    "hypothesis": "Core contracts handle critical operations, periphery handles UI/convenience functions",
    "validation": "Confirmed by checking import graph and function visibility",
    "conclusion": "Focus audit on src/core/ contracts as they have highest risk"
  }
}
```

## Quality Checks

Before marking this milestone complete:

- [ ] All source files read and understood
- [ ] Dependency graph constructed
- [ ] Critical paths identified
- [ ] External dependencies documented
- [ ] Business logic clear
- [ ] Context properly cached (if caching enabled)

## Time Estimate

- Small project (<10 files): 2-3 minutes
- Medium project (10-50 files): 5-10 minutes
- Large project (>50 files): 15-30 minutes

## Notes

- Do NOT analyze vulnerabilities yet (that's Milestone 2-3)
- Focus on UNDERSTANDING, not FINDING issues
- Build a mental model you'll reference in later milestones
- This milestone's context should be cached for efficiency
