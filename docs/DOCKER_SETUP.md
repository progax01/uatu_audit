# Docker Setup for Uatu Audit

This guide explains how to set up and use the Docker-based sandboxed environment for running security tools safely.

## Why Docker?

Docker provides isolated, secure environments for running security tools when auditing untrusted smart contract code. Key benefits:

- **Security Isolation**: Prevents malicious code from accessing your file system, network, or other resources
- **Consistent Environment**: Same tool versions across all developers and CI/CD
- **Easy Setup**: No need to manually install 28+ security tools
- **Resource Control**: Limit CPU, memory, and disk usage

## Prerequisites

1. **Docker** (version 20.10 or higher)
   ```bash
   docker --version
   ```

2. **Docker Compose** (version 1.29 or higher)
   ```bash
   docker-compose --version
   ```

### Installing Docker

#### macOS
```bash
# Install via Homebrew
brew install --cask docker

# Or download from: https://docs.docker.com/desktop/install/mac-install/
```

#### Linux
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Or follow: https://docs.docker.com/engine/install/
```

#### Windows
Download and install Docker Desktop from: https://docs.docker.com/desktop/install/windows-install/

## Quick Start

### 1. Build Docker Images

Build all ecosystem images (this will take 10-20 minutes on first build):

```bash
docker-compose build
```

Or build specific ecosystem:

```bash
# Solidity tools only
docker-compose build audit-solidity

# Rust/Solana tools only
docker-compose build audit-rust

# Move tools only
docker-compose build audit-move
```

### 2. Verify Images

Check that images were built successfully:

```bash
docker images | grep uatu-audit
```

You should see:
```
uatu-audit-solidity    latest    <image-id>    <size>
uatu-audit-rust        latest    <image-id>    <size>
uatu-audit-move        latest    <image-id>    <size>
```

### 3. Test an Image

Test the Solidity image:

```bash
docker run --rm uatu-audit-solidity:latest slither --version
docker run --rm uatu-audit-solidity:latest forge --version
docker run --rm uatu-audit-solidity:latest mythril version
```

## Docker Images

### uatu-audit-solidity
**Size:** ~3-4 GB
**Tools:**
- Foundry (forge, cast, anvil)
- Slither (static analyzer)
- Mythril (symbolic execution)
- Semgrep (pattern matching)
- Hardhat (testing framework)
- Solc (multiple versions)

**Use for:** Ethereum, Arbitrum, Polygon, Base, Optimism, BSC

### uatu-audit-rust
**Size:** ~4-5 GB
**Tools:**
- Anchor (Solana framework)
- Solana CLI
- Cargo Clippy (linter)
- Cargo Audit (vulnerability scanner)
- Cargo Geiger (unsafe code detector)
- Soteria (Solana security scanner)

**Use for:** Solana, Anchor programs

### uatu-audit-move
**Size:** ~3-4 GB
**Tools:**
- Aptos CLI
- Sui CLI
- Move Prover (formal verification)

**Use for:** Aptos, Sui, Move-based chains

## Using Docker in Audits

### Automatic Docker Usage

Uatu will automatically use Docker when:
1. Required security tools are not installed locally
2. Docker is available on the system
3. The appropriate Docker image exists

### Manual Docker Control

Set environment variable to force Docker usage:

```bash
# Always use Docker (even if tools are installed)
FORCE_DOCKER=true npm run dev

# Disable Docker (use only native tools)
DISABLE_DOCKER=true npm run dev
```

### Running Tools Manually

Test tools manually for debugging:

```bash
# Clone a test repository
git clone https://github.com/Uniswap/v2-core.git /tmp/test-repo

# Run Slither on it
docker run --rm \
  -v /tmp/test-repo:/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  --network none \
  uatu-audit-solidity:latest \
  slither . --json /audit/output/slither.json

# Check output
cat /tmp/output/slither.json
```

## Security Features

### 1. Read-Only Source
The source code directory is mounted read-only. Tools cannot modify your code.

```yaml
volumes:
  - ./test-repos:/audit/source:ro  # :ro = read-only
```

### 2. Network Isolation
Containers have no network access by default.

```yaml
networks:
  audit-isolated:
    internal: true  # No external network
```

### 3. Resource Limits
CPU and memory are limited to prevent resource exhaustion.

```yaml
mem_limit: 4g
cpus: 2.0
```

### 4. Seccomp Profile
Restricts system calls to only essential ones (`docker/seccomp-audit.json`).

### 5. No Privilege Escalation
Containers cannot gain additional privileges.

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL  # Drop all capabilities
```

### 6. AppArmor Profile
Additional kernel-level security (Linux only, `docker/apparmor-audit`).

## Troubleshooting

### Docker Not Found

**Error:** `Docker is not available`

**Solution:**
```bash
# Check Docker is installed
docker --version

# Start Docker Desktop (macOS/Windows)
open -a Docker

# Start Docker daemon (Linux)
sudo systemctl start docker
```

### Image Not Found

**Error:** `Docker image uatu-audit-solidity:latest not found`

**Solution:**
```bash
# Build the image
docker-compose build audit-solidity

# Or pull if available
docker pull uatu-audit-solidity:latest
```

### Permission Denied

**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Solution (Linux):**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo (not recommended)
sudo docker-compose build
```

### Build Failures

**Error:** `Failed to build Docker image`

**Solution:**
```bash
# Clean Docker cache
docker system prune -a

# Rebuild with no cache
docker-compose build --no-cache

# Check disk space
df -h
```

### Slow Builds

**Tips:**
- First build takes 10-20 minutes (downloads and compiles tools)
- Subsequent builds are faster (uses cache)
- Use `--parallel` to build multiple images simultaneously:
  ```bash
  docker-compose build --parallel
  ```

### Tool Timeouts

**Error:** `Docker execution timed out`

**Solution:**
Increase timeout in `src/config/docker.ts`:
```typescript
timeouts: {
  mythril: 600000,  // Increase from 5min to 10min
}
```

## Advanced Usage

### Custom Docker Images

Build custom image with additional tools:

```dockerfile
# docker/solidity-custom.Dockerfile
FROM uatu-audit-solidity:latest

# Add your custom tools
RUN pip3 install manticore
RUN npm install -g @openzeppelin/hardhat-upgrades
```

```bash
# Build custom image
docker build -f docker/solidity-custom.Dockerfile -t uatu-audit-solidity-custom:latest .
```

### Development Mode

Run container in interactive mode for debugging:

```bash
docker run -it --rm \
  -v $(pwd):/audit/source:ro \
  -v /tmp/output:/audit/output:rw \
  uatu-audit-solidity:latest \
  /bin/bash
```

Inside container:
```bash
# Test tools
slither --version
forge --version

# Run manual analysis
cd /audit/source
slither . --print human-summary
```

### CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/audit.yml
name: Smart Contract Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: docker-compose build

      - name: Run audit
        run: npm run audit:ci
```

#### GitLab CI

```yaml
# .gitlab-ci.yml
audit:
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker-compose build
    - npm run audit:ci
```

## Updating Images

### Update Tool Versions

Edit Dockerfiles to update tool versions:

```dockerfile
# docker/solidity.Dockerfile
# Update Mythril
RUN pip3 install mythril==0.24.0  # Specify version

# Update Foundry
RUN foundryup --version nightly-<commit-hash>
```

Rebuild:
```bash
docker-compose build --no-cache audit-solidity
```

### Update Base Images

```dockerfile
# Update Ubuntu base
FROM ubuntu:22.04  # -> ubuntu:24.04

# Update Rust base
FROM rust:1.75  # -> rust:1.80
```

## Maintenance

### Clean Up Old Images

```bash
# Remove unused images
docker image prune -a

# Remove all stopped containers
docker container prune

# Full cleanup (careful!)
docker system prune -a --volumes
```

### Check Image Sizes

```bash
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### Optimize Images

Use multi-stage builds to reduce size:

```dockerfile
# Build stage
FROM rust:1.75 AS builder
RUN cargo install anchor-cli

# Runtime stage
FROM ubuntu:22.04
COPY --from=builder /usr/local/cargo/bin/anchor /usr/local/bin/
```

## Security Considerations

### What Docker Protects Against

- ✅ Malicious code accessing your file system
- ✅ Malicious code making network requests
- ✅ Malicious code stealing credentials (SSH keys, AWS keys, etc.)
- ✅ Resource exhaustion (CPU, memory)
- ✅ Privilege escalation attacks

### What Docker Does NOT Protect Against

- ❌ Vulnerabilities in Docker itself (keep Docker updated)
- ❌ Kernel exploits (rare but possible)
- ❌ Side-channel attacks
- ❌ Malicious code in audit results (always review findings)

### Best Practices

1. **Keep Docker Updated:** `docker version` to check
2. **Review Audit Results:** Don't blindly trust tool output
3. **Limit Volume Mounts:** Only mount what's needed
4. **Use Read-Only Mounts:** Prevent code modification
5. **Monitor Resource Usage:** `docker stats`
6. **Regular Security Audits:** Review Dockerfiles and configs

## Getting Help

### Documentation
- Docker Docs: https://docs.docker.com/
- Docker Security: https://docs.docker.com/engine/security/
- Seccomp: https://docs.docker.com/engine/security/seccomp/

### Uatu-Specific
- GitHub Issues: https://github.com/yourusername/uatu-audit/issues
- Discord: [Your Discord Link]
- Email: security@uatu.io

## Summary

✅ **Install Docker** (version 20.10+)
✅ **Build images** (`docker-compose build`)
✅ **Verify** (`docker images | grep uatu-audit`)
✅ **Run audits** (automatic Docker usage)
✅ **Keep updated** (rebuild images periodically)

Docker provides a secure, isolated environment for auditing untrusted smart contracts. All security tools run in sandboxed containers with no access to your host system, network, or sensitive files.
