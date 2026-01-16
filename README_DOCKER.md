# 🐳 Docker Security Infrastructure - Quick Reference

**Zero-install security tool infrastructure for Uatu Audit**

---

## 🎯 Quick Start

### Check What Tools Are Available

```bash
# See everything (recommended)
node dist/bin/uatu.js tools

# JSON format (for scripts)
node dist/bin/uatu.js tools --json

# Claude AI context (what AI sees)
node dist/bin/uatu.js tools --claude
```

### Current Status

**15 out of 16 tools operational (94%)**

```
✅ 3 Native Tools (already on your system)
🐳 12 Docker Tools (in containers)
❌ 1 Unavailable (Cargo Contract - optional)
```

---

## 📦 Docker Images

```bash
$ docker images | grep uatu-audit

uatu-audit-move       latest   3.49 GB   (Aptos + flagged Move tools)
uatu-audit-rust       latest   3.17 GB   (Anchor, Soteria, Cargo tools)
uatu-audit-solidity   latest   5.27 GB   (Slither, Mythril, Forge, Semgrep)

Total: 11.93 GB
```

---

## 🛠️ Tools by Ecosystem

### Solidity/EVM (6 tools) ✅
- **Slither** v0.11.3 - Static analysis
- **Mythril** - Symbolic execution
- **Forge** v1.5.1 - Build & test
- **Semgrep** v1.148.0 - Pattern matching
- **Hardhat** - Testing framework
- **Solc** - Multi-version compiler

### Rust/Solana (6 tools) ✅
- **Anchor** v0.32.1 - Solana framework
- **Cargo Clippy** v0.1.83 - Linter
- **Cargo Audit** - CVE scanner
- **Cargo Geiger** - Unsafe detector
- **Soteria** v0.0.2 - Solana security
- **Solana CLI** v2.1.16 (native)

### Move/Aptos (1 tool) ✅
- **Aptos CLI** v7.14.1 - Move development

---

## 🚀 Quick Commands

### Test Individual Tools

```bash
# Solidity
docker run --rm uatu-audit-solidity:latest slither --version
docker run --rm uatu-audit-solidity:latest forge --version

# Rust
docker run --rm uatu-audit-rust:latest anchor --version
docker run --rm uatu-audit-rust:latest soteria --version

# Move
docker run --rm uatu-audit-move:latest aptos --version
```

### Rebuild Images

```bash
# Rebuild one
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .

# Rebuild all
docker-compose build

# Rebuild without cache
docker-compose build --no-cache
```

### Start Auditing

```bash
npm run build
npm run dev

# Visit: http://localhost:9091
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **TOOLS_AVAILABILITY.md** | Complete tool reference (versions, usage, examples) |
| **IMPLEMENTATION_COMPLETE.md** | Full implementation summary |
| **DOCKER_QUICKSTART.md** | Quick start guide |
| **docs/DOCKER_SETUP.md** | Detailed setup (200+ lines) |
| **docs/ARM_COMPATIBILITY.md** | Apple Silicon notes |

---

## 🔐 Security Features

Every container runs with:

- ✅ **Read-only source code** - Cannot modify code being audited
- ✅ **Network isolation** - No internet access (`--network none`)
- ✅ **Resource limits** - 4GB RAM, 2 CPU cores max
- ✅ **Seccomp & AppArmor** - Kernel-level security
- ✅ **Capabilities dropped** - Minimal permissions
- ✅ **Isolated /tmp** - 1GB limit, noexec, nosuid

---

## 🎨 What Claude AI Sees

Run: `node dist/bin/uatu.js tools --claude`

Output shows Claude exactly which tools are available:

```markdown
### Solidity Ecosystem
- ✅ Slither (docker) - Ready
- ✅ Mythril (docker) - Ready
- ✅ Forge (native) - Ready
...

### Rust Ecosystem
- ✅ Anchor (docker) - Ready
- ✅ Soteria (docker) - Ready
...
```

This context is **automatically passed to Claude during audits!**

---

## 🔧 Troubleshooting

### Image Not Found
```bash
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
```

### Out of Memory
1. Docker Desktop → Settings → Resources
2. Increase to 8GB+ RAM
3. Rebuild images

### Permission Denied
```bash
# Start Docker Desktop (macOS/Windows)
# Or: sudo systemctl start docker (Linux)
```

---

## 📊 Quick Stats

- **Total Tools:** 16
- **Operational:** 15 (94%)
- **Docker Images:** 3
- **Total Size:** 11.93 GB
- **Ecosystems:** Solidity, Rust/Solana, Move/Aptos
- **Security Layers:** 8 (read-only, network isolation, resource limits, etc.)

---

## 🎯 Next Steps

1. **Check availability:** `node dist/bin/uatu.js tools`
2. **Start daemon:** `npm run dev`
3. **Audit projects:** Visit http://localhost:9091
4. **Read full docs:** See `TOOLS_AVAILABILITY.md`

---

**Status:** ✅ Production Ready
**Last Updated:** January 16, 2026
