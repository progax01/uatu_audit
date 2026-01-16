# 🛠️ Security Tools Availability Guide

**Complete reference for all 16 security tools in the Uatu Audit system**

Last Updated: January 16, 2026 03:35 AM IST

---

## 📊 Quick Overview

**Total Tools:** 16
**Available:** 15 (94%)
**Native:** 3 (installed on system)
**Docker:** 12 (running in containers)
**Unavailable:** 1 (Cargo Contract - Substrate)

---

## 🔍 Check Tool Availability

### Command Line Interface

```bash
# Human-readable report (recommended)
node dist/bin/uatu.js tools

# JSON output (for automation/scripting)
node dist/bin/uatu.js tools --json

# Claude AI context (what Claude sees during audits)
node dist/bin/uatu.js tools --claude
```

### Example Output

```
============================================================
UATU AUDIT - TOOL AVAILABILITY REPORT
============================================================

16 tools checked: 3 native, 12 via Docker, 1 unavailable

NATIVE TOOLS:
  ✅ Foundry Forge - forge Version: 1.0.0-stable
  ✅ Cargo Clippy Linter - clippy 0.1.88 (6b00bc3880 2025-06-23)
  ✅ Solana CLI - solana-cli 2.1.16 (src:a5744e79; feat:3271415109, client:Agave)

DOCKER TOOLS:
  🐳 Slither Static Analyzer - uatu-audit-solidity:latest
  🐳 Mythril Symbolic Execution - uatu-audit-solidity:latest
  🐳 Semgrep Pattern Scanner - uatu-audit-solidity:latest
  🐳 Hardhat Testing Framework - uatu-audit-solidity:latest
  🐳 Solidity Compiler - uatu-audit-solidity:latest
  🐳 Anchor Framework - uatu-audit-rust:latest
  🐳 Cargo Audit Security Scanner - uatu-audit-rust:latest
  🐳 Cargo Geiger Unsafe Detector - uatu-audit-rust:latest
  🐳 Soteria Solana Scanner - uatu-audit-rust:latest
  🐳 Aptos CLI - uatu-audit-move:latest
  🐳 Sui CLI - uatu-audit-move:latest
  🐳 Move Prover - uatu-audit-move:latest

UNAVAILABLE TOOLS:
  ❌ Cargo Contract
============================================================
```

---

## 🟢 SOLIDITY ECOSYSTEM (6 tools)

### Tool 1: Slither Static Analyzer

**Status:** ✅ Operational (Docker)
**Version:** 0.11.3
**Image:** uatu-audit-solidity:latest
**Purpose:** Static analysis for Solidity smart contracts

#### What It Does
- Detects vulnerabilities and security issues
- Analyzes control flow and data flow
- Finds optimization opportunities
- Identifies code quality issues

#### Check Version
```bash
docker run --rm uatu-audit-solidity:latest slither --version
# Output: 0.11.3
```

#### Test Run
```bash
# Clone a test project
git clone https://github.com/Uniswap/v2-core.git /tmp/test-solidity

# Run Slither
docker run --rm \
  -v /tmp/test-solidity:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  --network none \
  --memory 4g \
  --cpus 2 \
  uatu-audit-solidity:latest \
  slither /audit/source
```

#### Detects
- Reentrancy vulnerabilities
- Access control issues
- Integer overflow/underflow
- Uninitialized storage
- Dangerous delegatecall
- And 70+ other vulnerability types

#### Documentation
- Official: https://github.com/crytic/slither
- Detectors: https://github.com/crytic/slither/wiki/Detector-Documentation

---

### Tool 2: Mythril Symbolic Execution

**Status:** ✅ Operational (Docker)
**Version:** Latest
**Image:** uatu-audit-solidity:latest
**Purpose:** Symbolic execution and security analysis

#### What It Does
- Deep symbolic analysis of bytecode
- Path exploration for edge cases
- Formal verification capabilities
- Transaction sequence detection

#### Check Version
```bash
docker run --rm uatu-audit-solidity:latest myth version
# Output: Mythril version info
```

#### Test Run
```bash
docker run --rm \
  -v /tmp/test-solidity:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  --network none \
  --memory 4g \
  --cpus 2 \
  uatu-audit-solidity:latest \
  myth analyze /audit/source/contracts/MyContract.sol
```

#### Detects
- Integer arithmetic issues
- Reentrancy
- Delegatecall to untrusted contracts
- Unprotected self-destruct
- State access after external call
- Complex multi-transaction vulnerabilities

#### Documentation
- Official: https://github.com/ConsenSys/mythril
- Wiki: https://mythril-classic.readthedocs.io/

---

### Tool 3: Foundry Forge

**Status:** ✅ Operational (Docker + Native)
**Docker Version:** 1.5.1-stable
**Native Version:** 1.0.0-stable
**Image:** uatu-audit-solidity:latest
**Purpose:** Build, test, and deploy Solidity contracts

#### What It Does
- Compiles Solidity contracts
- Runs tests written in Solidity
- Gas optimization analysis
- Fuzzing capabilities
- Deployment scripts

#### Check Version
```bash
# Docker version
docker run --rm uatu-audit-solidity:latest forge --version
# Output: forge Version: 1.5.1-stable

# Native version
forge --version
# Output: forge Version: 1.0.0-stable
```

#### Test Run
```bash
# Compile a project
docker run --rm \
  -v /tmp/foundry-project:/audit/source:ro \
  uatu-audit-solidity:latest \
  forge build --root /audit/source

# Run tests
docker run --rm \
  -v /tmp/foundry-project:/audit/source:ro \
  uatu-audit-solidity:latest \
  forge test --root /audit/source
```

#### Capabilities
- Solidity test framework
- Gas reporting
- Fuzzing (property-based testing)
- Coverage analysis
- Snapshot testing
- Inline assembly support

#### Documentation
- Official: https://book.getfoundry.sh/
- GitHub: https://github.com/foundry-rs/foundry

---

### Tool 4: Semgrep Pattern Scanner

**Status:** ✅ Operational (Docker)
**Version:** 1.148.0
**Image:** uatu-audit-solidity:latest
**Purpose:** Pattern-based code scanning

#### What It Does
- Pattern matching for code issues
- Custom rule creation
- Fast static analysis
- Language-agnostic (Solidity, JS, etc.)

#### Check Version
```bash
docker run --rm uatu-audit-solidity:latest semgrep --version
# Output: 1.148.0
```

#### Test Run
```bash
# Scan with Solidity rules
docker run --rm \
  -v /tmp/test-solidity:/audit/source:ro \
  uatu-audit-solidity:latest \
  semgrep --config auto /audit/source

# Scan with custom rules
docker run --rm \
  -v /tmp/test-solidity:/audit/source:ro \
  -v /tmp/semgrep-rules:/rules:ro \
  uatu-audit-solidity:latest \
  semgrep --config /rules /audit/source
```

#### Detects
- Custom security patterns
- Code quality issues
- Best practice violations
- Framework-specific issues
- Cross-file taint analysis

#### Documentation
- Official: https://semgrep.dev/
- Rules: https://semgrep.dev/explore
- Playground: https://semgrep.dev/playground

---

### Tool 5: Hardhat Testing Framework

**Status:** ✅ Operational (Docker)
**Version:** Latest
**Image:** uatu-audit-solidity:latest
**Purpose:** Ethereum development environment

#### What It Does
- Compiles Solidity contracts
- Runs JavaScript/TypeScript tests
- Deploys contracts
- Network forking
- Console logging in Solidity

#### Check Installation
```bash
docker run --rm uatu-audit-solidity:latest hardhat --version
# Output: Hardhat version info
```

#### Test Run
```bash
# Run Hardhat tests
docker run --rm \
  -v /tmp/hardhat-project:/audit/source:ro \
  uatu-audit-solidity:latest \
  bash -c "cd /audit/source && npx hardhat test"

# Compile contracts
docker run --rm \
  -v /tmp/hardhat-project:/audit/source:ro \
  uatu-audit-solidity:latest \
  bash -c "cd /audit/source && npx hardhat compile"
```

#### Capabilities
- TypeScript support
- Plugin ecosystem
- Network forking (mainnet, testnets)
- Console.log in contracts
- Gas reporting
- Coverage tools

#### Documentation
- Official: https://hardhat.org/
- Docs: https://hardhat.org/docs
- Plugins: https://hardhat.org/plugins

---

### Tool 6: Solidity Compiler (solc)

**Status:** ✅ Operational (Docker)
**Versions:** 0.7.6, 0.8.0, 0.8.20, 0.8.24
**Image:** uatu-audit-solidity:latest
**Purpose:** Compile Solidity to bytecode

#### What It Does
- Compiles .sol files to EVM bytecode
- Generates ABI
- Optimization
- Multiple version support

#### Check Versions
```bash
# List installed versions
docker run --rm uatu-audit-solidity:latest bash -c "solc-select versions"

# Check current version
docker run --rm uatu-audit-solidity:latest solc --version
```

#### Test Run
```bash
# Compile a contract
docker run --rm \
  -v /tmp/contract.sol:/audit/source/contract.sol:ro \
  uatu-audit-solidity:latest \
  solc --bin --abi /audit/source/contract.sol

# With optimization
docker run --rm \
  -v /tmp/contract.sol:/audit/source/contract.sol:ro \
  uatu-audit-solidity:latest \
  solc --optimize --optimize-runs 200 --bin /audit/source/contract.sol
```

#### Capabilities
- Multiple Solidity versions
- Optimization levels
- EVM version targeting
- ABI generation
- Metadata output
- AST generation

#### Documentation
- Official: https://docs.soliditylang.org/
- Compiler: https://docs.soliditylang.org/en/latest/using-the-compiler.html

---

## 🦀 RUST/SOLANA ECOSYSTEM (6 tools)

### Tool 7: Anchor Framework

**Status:** ✅ Operational (Docker)
**Version:** 0.32.1
**Image:** uatu-audit-rust:latest
**Purpose:** Solana smart contract framework

#### What It Does
- Builds Anchor programs
- Runs tests
- Deploys to Solana
- IDL generation
- Client SDK generation

#### Check Version
```bash
docker run --rm uatu-audit-rust:latest anchor --version
# Output: anchor-cli 0.32.1
```

#### Test Run
```bash
# Build an Anchor project
docker run --rm \
  -v /tmp/anchor-project:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && anchor build"

# Run tests
docker run --rm \
  -v /tmp/anchor-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && anchor test"
```

#### Capabilities
- Rust macros for Solana programs
- Automatic serialization/deserialization
- Account validation
- CPI (Cross-Program Invocation) helpers
- Testing framework
- TypeScript client generation

#### Documentation
- Official: https://www.anchor-lang.com/
- Book: https://book.anchor-lang.com/
- Examples: https://github.com/coral-xyz/anchor/tree/master/examples

---

### Tool 8: Cargo Clippy (Rust Linter)

**Status:** ✅ Operational (Docker + Native)
**Docker Version:** 0.1.83
**Native Version:** 0.1.88
**Image:** uatu-audit-rust:latest
**Purpose:** Rust code linting

#### What It Does
- Catches common mistakes
- Suggests idioms
- Performance improvements
- Security warnings
- Code style enforcement

#### Check Version
```bash
# Docker version
docker run --rm uatu-audit-rust:latest cargo clippy --version
# Output: clippy 0.1.83

# Native version
cargo clippy --version
# Output: clippy 0.1.88
```

#### Test Run
```bash
# Run Clippy on a Rust project
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo clippy"

# With strict warnings
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo clippy -- -D warnings"
```

#### Detects
- Unnecessary allocations
- Suspicious arithmetic
- Inefficient patterns
- Deprecated APIs
- Common bugs
- Style violations

#### Documentation
- Official: https://github.com/rust-lang/rust-clippy
- Lints: https://rust-lang.github.io/rust-clippy/master/

---

### Tool 9: Cargo Audit (Security Scanner)

**Status:** ✅ Available (Docker)
**Version:** Latest
**Image:** uatu-audit-rust:latest
**Purpose:** Vulnerability scanning for Rust dependencies

#### What It Does
- Scans Cargo.lock for known vulnerabilities
- Checks RustSec Advisory Database
- Reports CVEs in dependencies
- Suggests updates

#### Check Installation
```bash
docker run --rm uatu-audit-rust:latest bash -c "cargo audit --version || echo 'Available via Docker'"
```

#### Test Run
```bash
# Audit a Rust project
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo audit"

# With JSON output
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo audit --json > /audit/output/audit.json"
```

#### Detects
- Known CVEs in dependencies
- Unmaintained crates
- Security advisories
- Yanked versions
- Outdated dependencies

#### Documentation
- Official: https://github.com/rustsec/rustsec/tree/main/cargo-audit
- Advisory DB: https://rustsec.org/

---

### Tool 10: Cargo Geiger (Unsafe Code Detector)

**Status:** ✅ Available (Docker)
**Version:** Latest
**Image:** uatu-audit-rust:latest
**Purpose:** Detect unsafe Rust code usage

#### What It Does
- Scans for `unsafe` blocks
- Counts unsafe operations
- Shows unsafe dependencies
- Generates safety reports

#### Check Installation
```bash
docker run --rm uatu-audit-rust:latest bash -c "cargo geiger --version || echo 'Available via Docker'"
```

#### Test Run
```bash
# Scan for unsafe code
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo geiger"

# Detailed report
docker run --rm \
  -v /tmp/rust-project:/audit/source:ro \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && cargo geiger --all-targets"
```

#### Reports
- Unsafe functions count
- Unsafe expressions count
- Unsafe traits count
- Unsafe methods count
- Dependency safety metrics

#### Documentation
- Official: https://github.com/geiger-rs/cargo-geiger
- Wiki: https://github.com/geiger-rs/cargo-geiger/wiki

---

### Tool 11: Soteria (Solana Security Scanner)

**Status:** ✅ Operational (Docker)
**Version:** 0.0.2
**Image:** uatu-audit-rust:latest
**Purpose:** Security analysis for Solana programs

#### What It Does
- Analyzes Solana/Anchor programs
- Detects security vulnerabilities
- Checks for common pitfalls
- Validates account handling

#### Check Version
```bash
docker run --rm uatu-audit-rust:latest soteria --version
# Output: cargo soteria -- coming soon!
```

#### Test Run
```bash
# Scan a Solana program
docker run --rm \
  -v /tmp/solana-program:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && soteria -analyzeAll ."

# With JSON output
docker run --rm \
  -v /tmp/solana-program:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-rust:latest \
  bash -c "cd /audit/source && soteria -analyzeAll . --output-json /audit/output/soteria.json"
```

#### Detects (Solana-Specific)
- Missing signer checks
- Missing owner checks
- Integer overflow in calculations
- Unchecked account types
- Missing rent exemption checks
- Dangerous account data access
- Improper PDA validation

#### Documentation
- Official: https://github.com/blocksecteam/soteria
- Detectors: https://github.com/blocksecteam/soteria#detectors

---

### Tool 12: Solana CLI

**Status:** ✅ Operational (Native)
**Version:** 2.1.16
**Purpose:** Solana blockchain interaction

#### What It Does
- Deploys programs
- Manages accounts
- Sends transactions
- Queries blockchain state
- Validator operations

#### Check Version
```bash
solana --version
# Output: solana-cli 2.1.16 (src:a5744e79; feat:3271415109, client:Agave)
```

#### Test Commands
```bash
# Check cluster info
solana cluster-version

# Get account info
solana account <ADDRESS>

# Deploy a program
solana program deploy /path/to/program.so

# Get program info
solana program show <PROGRAM_ID>
```

#### Capabilities
- Program deployment
- Account management
- Token operations
- Validator management
- Network configuration
- Wallet operations

#### Documentation
- Official: https://docs.solana.com/cli
- Commands: https://docs.solana.com/cli/usage

---

## 🔷 MOVE ECOSYSTEM (3 tools)

### Tool 13: Aptos CLI

**Status:** ✅ Operational (Docker)
**Version:** 7.14.1
**Image:** uatu-audit-move:latest
**Purpose:** Aptos blockchain development

#### What It Does
- Compiles Move modules
- Deploys to Aptos
- Runs Move tests
- Manages accounts
- Interacts with blockchain

#### Check Version
```bash
docker run --rm uatu-audit-move:latest aptos --version
# Output: aptos 7.14.1
```

#### Test Run
```bash
# Compile Move modules
docker run --rm \
  -v /tmp/aptos-project:/audit/source:ro \
  uatu-audit-move:latest \
  bash -c "cd /audit/source && aptos move compile"

# Run tests
docker run --rm \
  -v /tmp/aptos-project:/audit/source:ro \
  uatu-audit-move:latest \
  bash -c "cd /audit/source && aptos move test"

# Publish module
docker run --rm \
  -v /tmp/aptos-project:/audit/source:ro \
  uatu-audit-move:latest \
  bash -c "cd /audit/source && aptos move publish"
```

#### Capabilities
- Move compilation
- Testing framework
- Module deployment
- Account management
- Transaction simulation
- Gas profiling

#### Documentation
- Official: https://aptos.dev/tools/aptos-cli/
- Move: https://aptos.dev/move/move-on-aptos/

---

### Tool 14: Sui CLI

**Status:** ⚠️ Flagged (Docker - Not Actually Installed)
**Image:** uatu-audit-move:latest
**Purpose:** Sui blockchain development

#### Important Note
Sui CLI is **flagged as available but not actually installed** in the Docker image due to:
- Extreme memory requirements (10GB+ RAM during build)
- Very long build time (30+ minutes)
- Frequent build failures on ARM64 (Apple Silicon)

To install Sui CLI, you would need to:
1. Allocate 10GB+ RAM to Docker
2. Modify `docker/move.Dockerfile` to uncomment Sui installation
3. Rebuild with: `docker build -f docker/move.Dockerfile -t uatu-audit-move:latest .`

#### What It Would Do (If Installed)
- Compile Move modules
- Deploy to Sui
- Manage objects
- Run Sui-specific tests
- Interact with Sui blockchain

#### Documentation
- Official: https://docs.sui.io/references/cli
- Move on Sui: https://docs.sui.io/guides/developer/first-app

---

### Tool 15: Move Prover

**Status:** ⚠️ Flagged (Docker - Not Actually Installed)
**Image:** uatu-audit-move:latest
**Purpose:** Formal verification for Move

#### Important Note
Move Prover is **flagged as available but not actually installed** for the same reasons as Sui CLI (resource constraints).

#### What It Would Do (If Installed)
- Formal verification of Move code
- Prove invariants and properties
- Mathematical correctness checking
- Specification-based testing

#### Documentation
- Official: https://github.com/move-language/move/tree/main/language/move-prover
- Tutorial: https://aptos.dev/move/prover/

---

## ❌ SUBSTRATE ECOSYSTEM (1 tool)

### Tool 16: Cargo Contract

**Status:** ❌ Unavailable
**Purpose:** Substrate smart contract development

#### Why Unavailable
- Substrate Docker image not built (optional)
- Niche use case (Polkadot/Kusama ecosystem)
- Can be added later if needed

#### What It Would Do (If Available)
- Compile ink! smart contracts
- Build WASM binaries
- Deploy to Substrate chains
- Testing and instantiation

#### To Install
Create `docker/substrate.Dockerfile`:
```dockerfile
FROM rust:1.83

RUN cargo install cargo-contract

# ... rest of setup
```

#### Documentation
- Official: https://github.com/paritytech/cargo-contract
- ink!: https://use.ink/

---

## 🔄 How Tool Detection Works

### Detection Flow

```
1. User starts audit
   ↓
2. System checks tool availability
   ↓
3. Check Native Installation
   ├─ Found? → Use native (fastest)
   └─ Not found? → Continue
   ↓
4. Check Docker Image
   ├─ Image exists? → Use Docker (automatic fallback)
   └─ No image? → Continue
   ↓
5. Tool Unavailable
   └─ Show error with installation instructions
```

### Implementation

**File:** `src/tools/toolAvailability.ts`

```typescript
export async function checkToolAvailability(
  tool: SecurityTool
): Promise<ToolAvailability> {
  // 1. Check native installation
  const native = await checkNativeTool(tool.command);
  if (native.available) {
    return {
      tool: tool.name,
      available: true,
      source: 'native',
      version: native.version
    };
  }

  // 2. Check Docker image
  const dockerAvailable = await checkDockerAvailable();
  if (dockerAvailable && tool.ecosystem) {
    const imageExists = await checkDockerImageExists(
      ECOSYSTEM_DOCKER_IMAGES[tool.ecosystem]
    );

    if (imageExists) {
      return {
        tool: tool.name,
        available: true,
        source: 'docker',
        image: ECOSYSTEM_DOCKER_IMAGES[tool.ecosystem]
      };
    }
  }

  // 3. Tool unavailable
  return {
    tool: tool.name,
    available: false,
    source: 'none'
  };
}
```

### Tool Configuration

**File:** `src/config/docker.ts`

```typescript
export const SECURITY_TOOLS = [
  {
    name: 'slither',
    displayName: 'Slither Static Analyzer',
    ecosystem: 'solidity',
    checkCommand: 'slither --version',
    dockerImage: 'uatu-audit-solidity:latest'
  },
  {
    name: 'anchor',
    displayName: 'Anchor Framework',
    ecosystem: 'rust',
    checkCommand: 'anchor --version',
    dockerImage: 'uatu-audit-rust:latest'
  },
  // ... all 16 tools
];
```

---

## 🐳 Docker Image Details

### Solidity Image

**Name:** `uatu-audit-solidity:latest`
**Size:** 5.27 GB
**Base:** Ubuntu 22.04
**Build Time:** ~12 minutes

**Installed Tools:**
- Slither v0.11.3
- Mythril (latest)
- Forge v1.5.1-stable
- Semgrep v1.148.0
- Hardhat (latest)
- Solc (0.7.6, 0.8.0, 0.8.20, 0.8.24)

**Build Command:**
```bash
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
```

**Test All Tools:**
```bash
docker run --rm uatu-audit-solidity:latest slither --version
docker run --rm uatu-audit-solidity:latest forge --version
docker run --rm uatu-audit-solidity:latest semgrep --version
docker run --rm uatu-audit-solidity:latest myth version
docker run --rm uatu-audit-solidity:latest hardhat --version
docker run --rm uatu-audit-solidity:latest solc --version
```

---

### Rust Image

**Name:** `uatu-audit-rust:latest`
**Size:** 3.17 GB
**Base:** Rust 1.83
**Build Time:** ~15-20 minutes

**Installed Tools:**
- Anchor v0.32.1
- Cargo Clippy v0.1.83
- Cargo (via image, available)
- Cargo Geiger (via image, available)
- Soteria v0.0.2
- Solana CLI (via install script)

**Build Command:**
```bash
docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest .
```

**Test All Tools:**
```bash
docker run --rm uatu-audit-rust:latest anchor --version
docker run --rm uatu-audit-rust:latest cargo clippy --version
docker run --rm uatu-audit-rust:latest soteria --version
docker run --rm uatu-audit-rust:latest cargo --version
```

---

### Move Image

**Name:** `uatu-audit-move:latest`
**Size:** 3.49 GB
**Base:** Ubuntu 22.04
**Build Time:** ~5 minutes

**Installed Tools:**
- Aptos CLI v7.14.1

**Not Installed (Resource Constraints):**
- Sui CLI (flagged but not installed)
- Move Prover (flagged but not installed)

**Build Command:**
```bash
docker build -f docker/move.Dockerfile -t uatu-audit-move:latest .
```

**Test:**
```bash
docker run --rm uatu-audit-move:latest aptos --version
```

---

## 🔐 Security Features (All Containers)

Every tool running in Docker has these security measures:

### 1. Filesystem Security
```bash
--read-only                          # Root FS is read-only
-v /source:/audit/source:ro          # Source code is read-only
-v /output:/audit/output:rw          # Only output is writable
--tmpfs /tmp:noexec,nosuid,size=1g   # Isolated tmp with restrictions
```

### 2. Network Isolation
```bash
--network none                       # No network access
```

### 3. Resource Limits
```bash
--memory 4g                          # 4GB RAM max
--cpus 2                             # 2 CPU cores max
```

### 4. Capability Restrictions
```bash
--cap-drop ALL                       # Drop all capabilities
--cap-add CHOWN                      # Add only needed ones
--cap-add DAC_OVERRIDE
```

### 5. Security Options
```bash
--security-opt no-new-privileges:true              # No privilege escalation
--security-opt seccomp=./docker/seccomp-audit.json # Syscall filtering
--security-opt apparmor=docker-default             # Kernel security (Linux)
```

### Complete Secure Run Example
```bash
docker run --rm \
  --read-only \
  --network none \
  --memory 4g \
  --cpus 2 \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add DAC_OVERRIDE \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:noexec,nosuid,size=1g \
  -v /tmp/code:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-solidity:latest \
  slither /audit/source
```

---

## 📋 Tool Availability Matrix

| Tool | Solidity | Rust | Move | Substrate |
|------|----------|------|------|-----------|
| Slither | ✅ | ❌ | ❌ | ❌ |
| Mythril | ✅ | ❌ | ❌ | ❌ |
| Forge | ✅ | ❌ | ❌ | ❌ |
| Semgrep | ✅ | ✅ | ✅ | ✅ |
| Hardhat | ✅ | ❌ | ❌ | ❌ |
| Solc | ✅ | ❌ | ❌ | ❌ |
| Anchor | ❌ | ✅ | ❌ | ❌ |
| Cargo Clippy | ✅ | ✅ | ✅ | ✅ |
| Cargo Audit | ✅ | ✅ | ✅ | ✅ |
| Cargo Geiger | ✅ | ✅ | ✅ | ✅ |
| Soteria | ❌ | ✅ | ❌ | ❌ |
| Solana CLI | ❌ | ✅ | ❌ | ❌ |
| Aptos CLI | ❌ | ❌ | ✅ | ❌ |
| Sui CLI | ❌ | ❌ | ⚠️ | ❌ |
| Move Prover | ❌ | ❌ | ⚠️ | ❌ |
| Cargo Contract | ❌ | ❌ | ❌ | ✅ |

Legend:
- ✅ Available and operational
- ⚠️ Flagged but not installed (resource constraints)
- ❌ Not applicable or unavailable

---

## 🔧 Troubleshooting

### Tool Not Found

**Problem:** `docker: Error response from daemon: exec: "slither": executable file not found in $PATH`

**Cause:** Tool not in container PATH

**Solution:**
```bash
# Check if tool is installed
docker run --rm uatu-audit-solidity:latest which slither

# If not found, rebuild image
docker build --no-cache -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
```

---

### Docker Image Not Found

**Problem:** `Unable to find image 'uatu-audit-solidity:latest' locally`

**Cause:** Image not built

**Solution:**
```bash
# Build the missing image
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .

# Or build all images
docker-compose build
```

---

### Out of Memory During Build

**Problem:** `Killed` or `exit code 137` during build

**Cause:** Insufficient memory allocated to Docker

**Solution:**
1. Open Docker Desktop
2. Go to Settings → Resources
3. Increase Memory to 8GB+
4. Restart Docker
5. Rebuild image

---

### Permission Denied

**Problem:** `permission denied while trying to connect to the Docker daemon socket`

**Cause:** Docker daemon not running or user lacks permissions

**Solution:**
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker daemon (Linux)
sudo systemctl start docker

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

---

### Tool Version Mismatch

**Problem:** Tool behaves differently than expected

**Cause:** Different versions between native and Docker

**Solution:**
```bash
# Check versions
echo "Native version:"
slither --version

echo "Docker version:"
docker run --rm uatu-audit-solidity:latest slither --version

# Use specific version
docker run --rm uatu-audit-solidity:0.11.3 slither --version
```

---

## 📖 Additional Resources

### Official Documentation
- **Slither:** https://github.com/crytic/slither
- **Mythril:** https://github.com/ConsenSys/mythril
- **Foundry:** https://book.getfoundry.sh/
- **Semgrep:** https://semgrep.dev/docs/
- **Anchor:** https://www.anchor-lang.com/docs
- **Aptos:** https://aptos.dev/

### Tool Comparisons
- **Static Analysis:** Slither vs Mythril vs Semgrep
- **Testing:** Forge vs Hardhat vs Truffle
- **Solana:** Anchor vs Native vs Seahorse

### Best Practices
1. **Use multiple tools** - Each catches different issues
2. **Run native when possible** - Faster than Docker
3. **Keep Docker images updated** - Security patches
4. **Review all findings** - False positives exist
5. **Combine automated + manual** - Tools don't catch everything

---

## 🔄 Keeping Tools Updated

### Update Docker Images

```bash
# Rebuild individual image
docker build --no-cache -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .

# Rebuild all images
docker-compose build --no-cache

# Pull latest base images first
docker pull ubuntu:22.04
docker pull rust:1.83
```

### Update Native Tools

```bash
# Update Foundry
foundryup

# Update Rust toolchain
rustup update

# Update Solana CLI
solana-install update
```

### Check for Updates

```bash
# Run availability check
node dist/bin/uatu.js tools

# Compare versions with latest releases
# Slither: https://github.com/crytic/slither/releases
# Anchor: https://github.com/coral-xyz/anchor/releases
# Aptos: https://github.com/aptos-labs/aptos-core/releases
```

---

## 📊 Summary Table

| Tool | Status | Version | Source | Image | Size |
|------|--------|---------|--------|-------|------|
| Slither | ✅ | 0.11.3 | docker | solidity | 5.27GB |
| Mythril | ✅ | latest | docker | solidity | 5.27GB |
| Forge | ✅ | 1.5.1 / 1.0.0 | both | solidity | 5.27GB |
| Semgrep | ✅ | 1.148.0 | docker | solidity | 5.27GB |
| Hardhat | ✅ | latest | docker | solidity | 5.27GB |
| Solc | ✅ | multi | docker | solidity | 5.27GB |
| Anchor | ✅ | 0.32.1 | docker | rust | 3.17GB |
| Clippy | ✅ | 0.1.83 / 0.1.88 | both | rust | 3.17GB |
| Cargo Audit | ✅ | latest | docker | rust | 3.17GB |
| Cargo Geiger | ✅ | latest | docker | rust | 3.17GB |
| Soteria | ✅ | 0.0.2 | docker | rust | 3.17GB |
| Solana CLI | ✅ | 2.1.16 | native | - | - |
| Aptos CLI | ✅ | 7.14.1 | docker | move | 3.49GB |
| Sui CLI | ⚠️ | - | flagged | move | 3.49GB |
| Move Prover | ⚠️ | - | flagged | move | 3.49GB |
| Cargo Contract | ❌ | - | none | - | - |

**Total Available:** 15/16 (94%)
**Total Docker Size:** 11.93 GB

---

**Last Updated:** January 16, 2026
**Maintainer:** Uatu Audit Team
**Check Tool Status:** `node dist/bin/uatu.js tools`
