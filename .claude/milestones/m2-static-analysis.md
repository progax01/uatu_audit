# Milestone 2: Static & Structural Analysis

## Objective

Perform structural analysis to identify static vulnerabilities, architectural issues, and code patterns that don't require deep logic simulation.

## Tasks

### 1. Architecture Mapping
- Contract inheritance hierarchy
- Interface implementations
- Library usage
- Modifier chains
- Access control structure

### 2. Static Vulnerability Detection

#### Web3-Specific
- Unprotected functions (missing access control)
- Unchecked return values
- Integer overflow/underflow (pre-0.8.0)
- Deprecated functions (suicide, throw, etc.)
- Missing events for critical operations
- Storage slot collisions (upgradeable contracts)
- Constructor vs initializer issues
- Delegatecall to untrusted contracts
- Selfdestruct in implementation contracts

#### Backend-Specific
- Hardcoded secrets/credentials
- Debug mode enabled
- Verbose error messages
- Missing security headers
- CORS misconfiguration
- Outdated dependencies with CVEs
- Insecure deserialization
- Missing rate limiting

#### Frontend-Specific
- Hardcoded API keys
- Sensitive data in localStorage
- Missing CSP headers
- dangerouslySetInnerHTML usage
- href="javascript:" links
- Missing input sanitization
- Source maps in production

### 3. Code Quality Analysis
- Commented-out code
- TODO/FIXME comments
- Dead code
- Unused imports
- Duplicate code
- Complex functions (high cyclomatic complexity)

### 4. Dependency Analysis
- Known CVEs in dependencies
- Outdated package versions
- Suspicious packages
- License compliance issues

### 5. Configuration Review
- Environment variables
- Network configurations
- Build settings
- Deployment scripts

## Detection Patterns

### Pattern 1: Missing Access Control
```
SEARCH: "function.*external|public"
FILTER: No "onlyOwner|onlyRole|require.*msg.sender"
CHECK: Does function modify state or transfer value?
SEVERITY: CRITICAL if yes, MEDIUM if no
```

### Pattern 2: Unchecked External Calls
```
SEARCH: ".call{|.transfer(|.send("
CHECK: Is return value checked?
SEVERITY: HIGH if unchecked and value transfer
```

### Pattern 3: Hardcoded Secrets
```
SEARCH: "password|api_key|private_key|secret" in string literals
CHECK: Is this in production code?
SEVERITY: CRITICAL if production
```

## Output Format

```json
{
  "milestone": 2,
  "status": "complete",
  "findings": [
    {
      "id": "STATIC-001",
      "severity": "CRITICAL",
      "confidence": 0.95,
      "category": "Access Control",
      "title": "Missing access control on withdraw()",
      "location": {
        "file": "src/Vault.sol",
        "line": 45,
        "function": "withdraw(uint256)"
      },
      "description": "The withdraw() function is marked external and has no access control modifier, allowing anyone to withdraw funds.",
      "code_snippet": "function withdraw(uint256 amount) external {\n    payable(msg.sender).transfer(amount);\n}",
      "impact": "Any user can drain the contract balance",
      "recommendation": "Add onlyOwner modifier or implement proper access control",
      "references": ["SWC-105"],
      "cwe": "CWE-284"
    }
  ],
  "static_metrics": {
    "total_findings": 15,
    "by_severity": {
      "critical": 2,
      "high": 5,
      "medium": 6,
      "low": 2,
      "info": 0
    },
    "by_category": {
      "access_control": 3,
      "unchecked_calls": 2,
      "code_quality": 10
    }
  },
  "reasoning": [
    {
      "step": "Scanning for missing access control",
      "observation": "Found 3 external functions without modifiers: withdraw(), updateConfig(), pause()",
      "hypothesis": "These may be missing access control",
      "validation": "Checked function bodies - no msg.sender validation present",
      "conclusion": "CRITICAL: 3 unprotected functions found",
      "confidence": 0.95
    }
  ]
}
```

## Chain-of-Thought Requirements

For each finding, document:

```json
{
  "reasoning": {
    "step": "Analyzing withdraw() function",
    "observation": "Function is external, transfers value, no access control modifier",
    "hypothesis": "Missing access control vulnerability",
    "validation": "Confirmed: no onlyOwner, no require(msg.sender == owner), no role check",
    "conclusion": "CRITICAL: Anyone can call withdraw() and drain funds",
    "confidence": 0.95,
    "confidence_factors": [
      "Pattern match: exact",
      "No protective measures found",
      "Function transfers value",
      "Historical: common vulnerability"
    ]
  }
}
```

## Quality Checks

- [ ] All external/public functions reviewed
- [ ] All external calls checked for return values
- [ ] All critical functions have access control
- [ ] No hardcoded secrets found
- [ ] Dependency vulnerabilities identified
- [ ] Architecture diagram complete

## Integration with Tools

If available, integrate with:
- **Web3**: Slither, Mythril, Semgrep
- **Backend**: npm audit, pip-audit, Snyk
- **Frontend**: ESLint security plugins, retire.js

Merge tool results with AI findings, deduplicate, and enrich with context.

## Time Estimate

- Small project: 5-10 minutes
- Medium project: 15-30 minutes
- Large project: 30-60 minutes

## Notes

- Focus on PATTERN MATCHING and STATIC ANALYSIS
- Save deep logic analysis for Milestone 3
- High confidence (>0.90) for clear pattern matches
- Lower confidence (<0.80) for potential issues requiring deeper analysis
