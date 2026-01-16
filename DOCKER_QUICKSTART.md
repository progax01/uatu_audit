# Docker Quick Start Guide

## 🎯 What Was Built

✅ **Phase 1 DONE**: Fixed error display - users now see actual error messages when audits fail
✅ **Phase 2 DONE**: Docker infrastructure - 3 ecosystem images with full security hardening
✅ **Phase 3 DONE**: Tool availability system - Claude knows which tools are available

## 📊 Current Status

Run this to see what tools are currently available:
```bash
npm run build
node dist/bin/uatu.js tools
```

**Current Result**:
- ✅ 3 tools available natively (forge, cargo-clippy, solana-cli)
- ❌ 13 tools unavailable (slither, mythril, semgrep, anchor, etc.)
- 🐳 Docker is running BUT images not built yet

## 🚀 Next Steps (YOU need to do this)

### Step 1: Build Docker Images (15-20 minutes)

Make sure Docker Desktop is running, then:

```bash
# Build all images at once
./scripts/build-docker.sh

# OR build in parallel (faster, more resources)
./scripts/build-docker.sh --parallel

# OR build one at a time
./scripts/build-docker.sh --solidity
./scripts/build-docker.sh --rust
./scripts/build-docker.sh --move
```

This will create 3 Docker images:
- `uatu-audit-solidity:latest` (~3-4 GB) - Slither, Mythril, Forge, Semgrep, Hardhat
- `uatu-audit-rust:latest` (~4-5 GB) - Anchor, Solana CLI, Cargo tools, Soteria
- `uatu-audit-move:latest` (~3-4 GB) - Aptos CLI, Sui CLI, Move Prover

### Step 2: Verify Images Built

```bash
# Check images exist
docker images | grep uatu-audit

# Should show 3 images
```

### Step 3: Test Tools in Docker

```bash
# Test Solidity tools
docker run --rm uatu-audit-solidity:latest slither --version
docker run --rm uatu-audit-solidity:latest forge --version
docker run --rm uatu-audit-solidity:latest myth version
docker run --rm uatu-audit-solidity:latest semgrep --version

# Test Rust tools
docker run --rm uatu-audit-rust:latest anchor --version
docker run --rm uatu-audit-rust:latest cargo clippy --version
docker run --rm uatu-audit-rust:latest solana --version

# Test Move tools
docker run --rm uatu-audit-move:latest aptos --version
docker run --rm uatu-audit-move:latest sui --version
```

### Step 4: Check Tool Availability Again

```bash
# Rebuild and check
npm run build
node dist/bin/uatu.js tools

# Should now show tools available via Docker!
```

### Step 5: See Claude-Friendly Context

```bash
# This is what Claude will see
node dist/bin/uatu.js tools --claude
```

Example output:
```markdown
# Available Security Tools

## Docker Images
- Solidity Tools: ✅ Built
- Rust/Solana Tools: ✅ Built
- Move Tools: ✅ Built

## Tool Availability
### Solidity Ecosystem
- ✅ **Slither Static Analyzer** (`slither`) (docker)
- ✅ **Mythril Symbolic Execution** (`mythril`) (docker)
- ✅ **Foundry Forge** (`forge`) (native)
...
```

## 🎨 What This Enables

Once images are built, the audit system can:

1. **Auto-detect available tools** - Knows what's native vs Docker
2. **Fallback to Docker** - If tool missing natively, uses Docker
3. **Secure execution** - All Docker tools run in isolated sandboxes
4. **Claude integration** - AI knows exactly which tools to use
5. **Zero manual installation** - No need to install slither, mythril, etc.

## 🔧 Example Audit Flow

**Before Docker**:
```
User starts audit → Check for slither → NOT FOUND → Error: "Missing tool slither"
```

**After Docker** (once you build images):
```
User starts audit → Check for slither → NOT FOUND natively
                  → Check Docker → Image FOUND
                  → Run slither in Docker container → Success!
                  → Claude receives: "✅ slither available (docker)"
```

## 📦 What Each Image Contains

### Solidity Image (`uatu-audit-solidity:latest`)
```
- Ubuntu 22.04 base
- Rust + Cargo (for Foundry)
- Foundry (forge, cast, anvil)
- Slither static analyzer
- Mythril symbolic execution
- Semgrep pattern matching
- Hardhat testing framework
- Solc compiler (multiple versions)
```

### Rust Image (`uatu-audit-rust:latest`)
```
- Rust 1.75 base
- Anchor framework
- Solana CLI
- Cargo Clippy (linter)
- Cargo Audit (vuln scanner)
- Cargo Geiger (unsafe detector)
- Soteria (Solana scanner)
```

### Move Image (`uatu-audit-move:latest`)
```
- Ubuntu 22.04 base
- Rust + Cargo
- Aptos CLI
- Sui CLI
- Move Prover (formal verification)
- Z3 theorem prover
```

## 🔒 Security Features

Each container runs with:
- ✅ Read-only source code mount
- ✅ No network access
- ✅ Limited CPU and memory
- ✅ Restricted system calls (seccomp)
- ✅ No privilege escalation
- ✅ Isolated temporary filesystem
- ✅ AppArmor security profile (Linux)

## 💻 Useful Commands

```bash
# Check Docker is running
docker info

# Check tool availability
node dist/bin/uatu.js tools

# Get JSON output
node dist/bin/uatu.js tools --json

# Get Claude context
node dist/bin/uatu.js tools --claude

# List Docker images
docker images | grep uatu-audit

# Check image sizes
docker images --format "table {{.Repository}}\t{{.Size}}"

# Remove old images
docker image prune -a

# View container logs (when running)
docker ps
docker logs <container-id>

# Run interactive shell in image
docker run -it --rm uatu-audit-solidity:latest /bin/bash
```

## 🐛 Troubleshooting

### Docker not running
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker

# Check status
docker info
```

### Build fails
```bash
# Clean cache
docker system prune -a

# Rebuild with no cache
docker-compose build --no-cache

# Check disk space
df -h
```

### Tool not found in image
```bash
# Verify tool is in image
docker run --rm uatu-audit-solidity:latest which slither

# Check tool version
docker run --rm uatu-audit-solidity:latest slither --version
```

## 📚 Documentation

- **Detailed Docker Setup**: `docs/DOCKER_SETUP.md`
- **Implementation Summary**: `docs/IMPLEMENTATION_SUMMARY.md`
- **Tool Availability Code**: `src/tools/toolAvailability.ts`
- **Docker Runner Code**: `src/tools/dockerRunner.ts`
- **Docker Config**: `src/config/docker.ts`

## ⏭️ After Building Images

Once images are built, next steps are:

1. **Update tool wrappers** - Make `slitherWrapper.ts`, `mythrilWrapper.ts` use Docker
2. **Update SOP orchestrator** - Pass tool context to Claude
3. **Test end-to-end audit** - Run full audit using Docker tools
4. **Monitor performance** - Check Docker overhead

See `docs/IMPLEMENTATION_SUMMARY.md` for detailed implementation guide.

## 🎯 Success Criteria

You'll know everything works when:

✅ `docker images` shows 3 uatu-audit images
✅ `node dist/bin/uatu.js tools` shows 13+ tools available
✅ Docker tools show "(docker)" in availability report
✅ Test commands run without errors
✅ Audit can run with Docker fallback

## 🚦 Quick Test

Run this to verify everything works:

```bash
# 1. Build images (15-20 min)
./scripts/build-docker.sh

# 2. Verify
docker images | grep uatu-audit

# 3. Test a tool
docker run --rm uatu-audit-solidity:latest slither --version

# 4. Check availability
npm run build && node dist/bin/uatu.js tools

# 5. See Claude context
node dist/bin/uatu.js tools --claude
```

If all 5 steps succeed, you're ready to go! 🎉

---

**Ready to build? Run:**
```bash
./scripts/build-docker.sh
```
