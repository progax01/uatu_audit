# Milestone 4: Verification Test Generation

## Objective

Generate executable Proof-of-Concept (PoC) tests that demonstrate and verify critical and high-severity vulnerabilities found in previous milestones.

## Tasks

### 1. Prioritize Findings for Test Generation
- Focus on CRITICAL and HIGH severity findings
- Prioritize findings with high confidence (>0.85)
- Generate tests that prove exploitability
- Skip theoretical or low-impact issues

### 2. Generate Domain-Specific Tests

#### Web3: Foundry Tests
For each Web3 vulnerability:
- Create `.t.sol` test file
- Use Foundry Test framework
- Include setup, exploit, and assertions
- Use vm cheatcodes (startPrank, deal, warp, etc.)
- Create attacker contracts if needed
- Demonstrate actual fund drain or state corruption

Template:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vulnerable.sol";

contract ExploitTest is Test {
    Vulnerable public target;
    Attacker public attacker;

    function setUp() public {
        target = new Vulnerable();
        attacker = new Attacker(address(target));
        vm.deal(address(target), 10 ether);
    }

    function testExploit() public {
        // Execute exploit
        // Assert success
    }
}
```

#### Backend: K6 Load Tests
For race conditions and concurrency issues:
- Generate K6 JavaScript scripts
- Simulate concurrent requests
- Demonstrate race condition exploitation
- Include timing and synchronization

Template:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '30s'
};

export default function() {
  // Concurrent request test
}
```

#### Backend: curl Commands
For injection and API vulnerabilities:
- Generate curl commands with exploit payloads
- Include headers and request bodies
- Show expected vs actual response
- Demonstrate vulnerability

Template:
```bash
curl -X POST http://api.example.com/endpoint \
  -H 'Content-Type: application/json' \
  -d '{"payload": "exploit"}'
```

#### Frontend: Cypress Tests
For XSS, state manipulation, etc.:
- Generate Cypress `.cy.js` test files
- Demonstrate client-side exploitation
- Verify security controls (or lack thereof)
- Check for data leakage

Template:
```javascript
describe('XSS Test', () => {
  it('should escape malicious input', () => {
    cy.visit('/search?q=<script>alert(1)</script>');
    // Assertions
  });
});
```

### 3. Test File Organization

```
artifacts/
├── foundry-tests/
│   ├── ReentrancyExploit.t.sol
│   ├── OracleManipulation.t.sol
│   └── AccessControlBypass.t.sol
├── k6-scripts/
│   ├── RaceCondition.js
│   └── DDoS.js
├── curl-commands/
│   └── exploits.sh
└── cypress-tests/
    ├── XSS.cy.js
    └── StateManipulation.cy.js
```

### 4. Test Documentation

Each test should include:
- **Purpose**: What vulnerability does this test prove?
- **Setup**: What initial state is needed?
- **Execution**: Step-by-step exploit flow
- **Expected Result**: What proves the vulnerability?
- **Run Command**: How to execute the test

## Output Format

```json
{
  "milestone": 4,
  "status": "complete",
  "tooling_artifacts": {
    "foundry_tests": [
      {
        "filename": "ReentrancyExploit.t.sol",
        "related_finding": "WEB3-001",
        "purpose": "Demonstrates reentrancy attack on withdraw() function",
        "run_command": "forge test --match-test testReentrancyExploit -vvv",
        "content": "// Full Solidity code here..."
      }
    ],
    "k6_scripts": [
      {
        "filename": "CouponRaceCondition.js",
        "related_finding": "BACKEND-003",
        "purpose": "Demonstrates race condition in coupon redemption",
        "run_command": "k6 run CouponRaceCondition.js",
        "content": "// Full K6 script here..."
      }
    ],
    "curl_commands": [
      {
        "finding": "BACKEND-001",
        "vulnerability": "NoSQL Injection",
        "command": "curl -X POST http://api.example.com/login -H 'Content-Type: application/json' -d '{\"username\":{\"$ne\":null},\"password\":{\"$ne\":null}}'",
        "expected_result": "Should return 400 Bad Request, but returns 200 with auth token (vulnerability confirmed)"
      }
    ],
    "cypress_tests": [
      {
        "filename": "SearchXSS.cy.js",
        "related_finding": "FRONTEND-002",
        "purpose": "Demonstrates DOM-based XSS in search component",
        "run_command": "npx cypress run --spec cypress/e2e/SearchXSS.cy.js",
        "content": "// Full Cypress test here..."
      }
    ]
  },
  "test_summary": {
    "total_tests_generated": 8,
    "foundry_tests": 3,
    "k6_scripts": 2,
    "curl_commands": 2,
    "cypress_tests": 1,
    "findings_with_tests": 8,
    "findings_without_tests": 4
  }
}
```

## Test Generation Guidelines

### Foundry Best Practices
```solidity
// ✓ Use descriptive test names
function testReentrancyDrainsVault() public { }

// ✓ Use vm cheatcodes
vm.startPrank(attacker);
vm.deal(address(attacker), 100 ether);
vm.warp(block.timestamp + 1 days);

// ✓ Include detailed assertions
assertEq(address(vault).balance, 0, "Vault should be empty");
assertGt(attacker.balance, initialBalance, "Attacker should profit");

// ✓ Log important values
console.log("Funds stolen:", stolenAmount);
console.log("Attacker profit:", profit);

// ✓ Test edge cases
function testExploitWithMinimumBalance() public { }
function testExploitWithMaximumBalance() public { }
```

### K6 Best Practices
```javascript
// ✓ Use realistic VU counts
export const options = {
  vus: 100, // Concurrent users
  duration: '30s'
};

// ✓ Include checks
check(res, {
  'only one success': (r) => r.status === 200 || r.status === 400
});

// ✓ Measure timing
const startTime = Date.now();
// ... execute requests
const endTime = Date.now();
console.log('Race window: ' + (endTime - startTime) + 'ms');

// ✓ Use thresholds
thresholds: {
  'http_req_failed': ['rate<0.01'],
  'checks': ['rate>0.95']
}
```

### Cypress Best Practices
```javascript
// ✓ Intercept XSS attempts
cy.on('window:alert', (str) => {
  throw new Error('XSS executed!');
});

// ✓ Check DOM manipulation
cy.get('.results').should('not.contain', '<script>');

// ✓ Verify state security
cy.window().then((win) => {
  expect(win.__REDUX_DEVTOOLS_EXTENSION__).to.be.undefined;
});

// ✓ Test actual exploits
cy.visit('/search?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
```

## Quality Checks

- [ ] Tests for all CRITICAL findings generated
- [ ] Tests for HIGH findings (confidence > 0.85) generated
- [ ] All tests are executable (no syntax errors)
- [ ] Tests include clear documentation
- [ ] Run commands provided for all tests
- [ ] Tests actually demonstrate the vulnerability

## Time Estimate

- Per CRITICAL finding: 10-15 minutes
- Per HIGH finding: 5-10 minutes
- Total for typical project: 30-60 minutes

## Notes

- Tests should PROVE vulnerabilities exist, not just check for them
- Include both successful exploit and attempted fix verification
- Tests should be runnable in isolation (no dependencies on other tests)
- Provide clear instructions for running tests
- For complex exploits, include step-by-step comments
