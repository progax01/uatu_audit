# 🖥️ Server Deployment Guide

**Deploy Uatu Audit with Docker on production servers**

---

## ✅ Server Compatibility

The Docker setup is **fully compatible with servers** and works on:

- ✅ **Linux servers** (Ubuntu, Debian, CentOS, RHEL, etc.)
- ✅ **Cloud VMs** (AWS EC2, Google Compute, Azure VMs, DigitalOcean, etc.)
- ✅ **Bare metal servers**
- ✅ **Container platforms** (Kubernetes, Docker Swarm, ECS)
- ✅ **CI/CD environments** (GitHub Actions, GitLab CI, Jenkins, CircleCI)
- ✅ **macOS servers** (Mac mini, Mac Studio)
- ⚠️ **Windows servers** (with Docker Desktop or WSL2)

---

## 🔐 How It Works on Servers

### Runtime Architecture

The Docker runner (`src/tools/dockerRunner.ts`) uses **direct `docker run` commands**, NOT docker-compose networking:

```typescript
docker run \
  --rm \
  --read-only \
  --network none \              # Complete network isolation
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  -v /path/to/source:/audit/source:ro \
  -v /path/to/output:/audit/output:rw \
  uatu-audit-solidity:latest \
  slither /audit/source
```

**Key Points:**
- ✅ No network dependencies during runtime
- ✅ No exposed ports needed
- ✅ Works with local Docker daemon or remote daemon
- ✅ Compatible with rootless Docker
- ✅ Works in air-gapped environments (after images are built)

---

## 📋 Server Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 8 GB | 16+ GB |
| **Disk** | 30 GB | 50+ GB SSD |
| **Docker** | 20.10+ | Latest stable |
| **OS** | Linux/macOS | Ubuntu 22.04 LTS |

### Disk Space Breakdown

```
Docker Images:     11.93 GB
Node Modules:      ~500 MB
Build Output:      ~200 MB
Workspace:         ~100 MB
Audit Cache:       Variable (1-10 GB)
----------------------------------
Total:             ~15-30 GB
```

### Network Requirements

**During Build:**
- ✅ Internet access required (to download packages)
- ✅ Access to Docker Hub, npm registry, GitHub
- ✅ Ports: 80, 443 outbound

**During Runtime:**
- ❌ No internet needed (containers isolated with `--network none`)
- ✅ Port 9091 (API server) - configurable
- ✅ All tool execution is offline

---

## 🚀 Server Installation

### Option 1: Ubuntu/Debian Server

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Add user to docker group (optional, for non-root)
sudo usermod -aG docker $USER
newgrp docker

# 3. Verify Docker
docker --version
docker ps

# 4. Clone repository
git clone https://github.com/your-org/uatu-audit.git
cd uatu-audit

# 5. Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 6. Install dependencies
npm install

# 7. Build Docker images
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest .
docker build -f docker/move.Dockerfile -t uatu-audit-move:latest .

# 8. Build application
npm run build

# 9. Verify tools
node dist/bin/uatu.js tools

# 10. Start server
npm run dev
```

---

### Option 2: CentOS/RHEL Server

```bash
# 1. Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# 2. Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# 3. Install Node.js
curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 4. Follow steps 4-10 from Ubuntu guide above
```

---

### Option 3: Cloud VM (AWS, GCP, Azure)

```bash
# Launch VM with:
# - Ubuntu 22.04 LTS or later
# - 4+ vCPUs
# - 8+ GB RAM
# - 30+ GB SSD

# SSH into VM
ssh user@your-server-ip

# Follow Ubuntu installation steps above

# Configure firewall (if needed)
sudo ufw allow 9091/tcp  # API port
sudo ufw enable
```

---

### Option 4: Docker Compose (Production)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  uatu-api:
    build:
      context: .
      dockerfile: Dockerfile
    image: uatu-audit-api:latest
    ports:
      - "9091:9091"
    volumes:
      - /var/lib/docker/volumes/uatu-data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Access host Docker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/uatu
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=uatu
      - POSTGRES_USER=uatu
      - POSTGRES_PASSWORD=changeme
    restart: unless-stopped

volumes:
  postgres-data:
```

Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔒 Security Hardening for Servers

### 1. Docker Daemon Security

**Enable Docker Content Trust:**
```bash
export DOCKER_CONTENT_TRUST=1
```

**Restrict Docker socket access:**
```bash
# Only allow docker group
sudo chmod 660 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock
```

**Use rootless Docker (recommended):**
```bash
# Install rootless Docker
curl -fsSL https://get.docker.com/rootless | sh

# Set up environment
export PATH=/home/$USER/bin:$PATH
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock

# Run as non-root user
docker ps
```

---

### 2. Firewall Configuration

**UFW (Ubuntu/Debian):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow API port
sudo ufw allow 9091/tcp

# Deny all other incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

**Firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-port=9091/tcp
sudo firewall-cmd --reload
```

---

### 3. SELinux Configuration (RHEL/CentOS)

```bash
# Allow Docker to access volumes
sudo setsebool -P container_manage_cgroup on

# If you get permission errors
sudo chcon -Rt svirt_sandbox_file_t /path/to/audit/source
```

---

### 4. AppArmor Configuration (Ubuntu/Debian)

The Docker setup already uses AppArmor profiles. To verify:

```bash
# Check if AppArmor is enabled
sudo aa-status

# Load custom profile (if needed)
sudo apparmor_parser -r docker/apparmor-audit
```

---

### 5. Resource Limits (systemd)

Create `/etc/systemd/system/uatu-audit.service`:

```ini
[Unit]
Description=Uatu Audit Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=uatu
WorkingDirectory=/opt/uatu-audit
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

# Resource limits
MemoryLimit=8G
CPUQuota=400%
TasksMax=4096

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/uatu-audit/data

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable uatu-audit
sudo systemctl start uatu-audit
```

---

## 🌐 Remote Docker Daemon

### Connect to Remote Docker Host

```bash
# Set remote Docker host
export DOCKER_HOST="tcp://remote-server:2376"
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=/path/to/certs

# Verify connection
docker ps

# Run tools on remote host
node dist/bin/uatu.js tools
```

### SSH Tunnel to Remote Docker

```bash
# Create SSH tunnel
ssh -NL localhost:2376:/var/run/docker.sock user@remote-server

# In another terminal
export DOCKER_HOST="tcp://localhost:2376"
docker ps
```

---

## 🔄 CI/CD Integration

### GitHub Actions

`.github/workflows/docker-build.yml`:

```yaml
name: Build Docker Images

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2

    - name: Build Solidity Image
      run: |
        docker build -f docker/solidity.Dockerfile \
          -t uatu-audit-solidity:latest .

    - name: Build Rust Image
      run: |
        docker build -f docker/rust.Dockerfile \
          -t uatu-audit-rust:latest .

    - name: Build Move Image
      run: |
        docker build -f docker/move.Dockerfile \
          -t uatu-audit-move:latest .

    - name: Test Tool Availability
      run: |
        npm install
        npm run build
        node dist/bin/uatu.js tools

    - name: Push to Registry (optional)
      if: github.ref == 'refs/heads/main'
      run: |
        echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
        docker push uatu-audit-solidity:latest
        docker push uatu-audit-rust:latest
        docker push uatu-audit-move:latest
```

---

### GitLab CI

`.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - deploy

build-images:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
    - docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest .
    - docker build -f docker/move.Dockerfile -t uatu-audit-move:latest .
    - docker save uatu-audit-solidity:latest | gzip > solidity.tar.gz
    - docker save uatu-audit-rust:latest | gzip > rust.tar.gz
    - docker save uatu-audit-move:latest | gzip > move.tar.gz
  artifacts:
    paths:
      - "*.tar.gz"
    expire_in: 1 day

test-tools:
  stage: test
  image: node:20
  services:
    - docker:dind
  script:
    - docker load < solidity.tar.gz
    - docker load < rust.tar.gz
    - docker load < move.tar.gz
    - npm install
    - npm run build
    - node dist/bin/uatu.js tools
```

---

### Jenkins Pipeline

`Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'your-registry.com'
    }

    stages {
        stage('Build Docker Images') {
            steps {
                sh '''
                    docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
                    docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest .
                    docker build -f docker/move.Dockerfile -t uatu-audit-move:latest .
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    npm install
                    npm run build
                    node dist/bin/uatu.js tools
                '''
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    docker tag uatu-audit-solidity:latest ${DOCKER_REGISTRY}/uatu-audit-solidity:latest
                    docker push ${DOCKER_REGISTRY}/uatu-audit-solidity:latest
                '''
            }
        }
    }
}
```

---

## 📦 Docker Registry Setup

### Push Images to Private Registry

```bash
# 1. Tag images for your registry
docker tag uatu-audit-solidity:latest registry.example.com/uatu-audit-solidity:latest
docker tag uatu-audit-rust:latest registry.example.com/uatu-audit-rust:latest
docker tag uatu-audit-move:latest registry.example.com/uatu-audit-move:latest

# 2. Login to registry
docker login registry.example.com

# 3. Push images
docker push registry.example.com/uatu-audit-solidity:latest
docker push registry.example.com/uatu-audit-rust:latest
docker push registry.example.com/uatu-audit-move:latest
```

### Pull Images on Server

```bash
# 1. Login on server
docker login registry.example.com

# 2. Pull images
docker pull registry.example.com/uatu-audit-solidity:latest
docker pull registry.example.com/uatu-audit-rust:latest
docker pull registry.example.com/uatu-audit-move:latest

# 3. Re-tag for local use
docker tag registry.example.com/uatu-audit-solidity:latest uatu-audit-solidity:latest
docker tag registry.example.com/uatu-audit-rust:latest uatu-audit-rust:latest
docker tag registry.example.com/uatu-audit-move:latest uatu-audit-move:latest

# 4. Verify
node dist/bin/uatu.js tools
```

---

## 🔍 Monitoring & Logging

### Docker Container Logging

```bash
# View logs from tool execution
docker logs -f container-name

# Export logs
docker logs container-name > /var/log/uatu/audit-$(date +%Y%m%d).log
```

### Application Logging

Configure in `src/config/logger.ts`:

```typescript
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: '/var/log/uatu/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: '/var/log/uatu/combined.log'
    }),
  ],
});
```

### System Monitoring

```bash
# Monitor Docker resource usage
docker stats

# Monitor disk usage
df -h
docker system df

# Monitor specific containers
docker stats $(docker ps -q --filter ancestor=uatu-audit-solidity:latest)
```

---

## 🐛 Troubleshooting Server Issues

### Issue 1: Docker Socket Permission Denied

**Error:**
```
Got permission denied while trying to connect to the Docker daemon socket
```

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo
sudo docker ps
```

---

### Issue 2: Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::9091
```

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :9091
sudo netstat -tlnp | grep 9091

# Kill the process
sudo kill -9 <PID>

# Or use a different port
export PORT=9092
npm run dev
```

---

### Issue 3: Out of Disk Space

**Error:**
```
no space left on device
```

**Solution:**
```bash
# Check disk usage
df -h
docker system df

# Clean up Docker
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Remove old containers
docker container prune
```

---

### Issue 4: SELinux Blocking Docker

**Error:**
```
Permission denied
```

**Solution:**
```bash
# Temporarily disable SELinux (not recommended for production)
sudo setenforce 0

# Or add proper context
sudo chcon -Rt svirt_sandbox_file_t /path/to/volumes

# Or run with --privileged (NOT recommended)
docker run --privileged ...
```

---

### Issue 5: Firewall Blocking Connections

**Error:**
```
Connection refused
```

**Solution:**
```bash
# Check firewall status
sudo ufw status
sudo firewall-cmd --list-all

# Allow port
sudo ufw allow 9091/tcp
sudo firewall-cmd --permanent --add-port=9091/tcp
sudo firewall-cmd --reload
```

---

## 📊 Performance Optimization

### 1. Use Docker BuildKit

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Build with BuildKit
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .
```

### 2. Layer Caching

```bash
# Use cache from registry
docker build \
  --cache-from registry.example.com/uatu-audit-solidity:latest \
  -f docker/solidity.Dockerfile \
  -t uatu-audit-solidity:latest .
```

### 3. Parallel Builds

```bash
# Build all images in parallel
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest . &
docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest . &
docker build -f docker/move.Dockerfile -t uatu-audit-move:latest . &
wait
```

### 4. Resource Allocation

Edit Docker daemon config `/etc/docker/daemon.json`:

```json
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
```

Restart Docker:
```bash
sudo systemctl restart docker
```

---

## ✅ Production Checklist

### Before Deployment

- [ ] Server meets minimum requirements (4 CPU, 8GB RAM, 30GB disk)
- [ ] Docker installed and running
- [ ] User has Docker permissions (or using rootless Docker)
- [ ] Firewall configured (port 9091 allowed)
- [ ] All 3 Docker images built successfully
- [ ] Tools availability verified (`node dist/bin/uatu.js tools`)
- [ ] Database configured and accessible
- [ ] Environment variables set correctly
- [ ] SSL/TLS certificates configured (for HTTPS)
- [ ] Backups configured
- [ ] Monitoring setup (logs, metrics, alerts)
- [ ] Security hardening applied (firewall, SELinux/AppArmor, etc.)

### After Deployment

- [ ] Verify all services running
- [ ] Test tool execution
- [ ] Check logs for errors
- [ ] Monitor resource usage
- [ ] Test audit workflow end-to-end
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up alerts for failures
- [ ] Document server-specific configuration

---

## 🎯 Quick Server Setup Commands

### One-Line Install (Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/uatu-audit/main/scripts/server-install.sh | bash
```

### Manual Setup (Copy-Paste)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh && \
sudo usermod -aG docker $USER && \
newgrp docker && \

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
sudo apt-get install -y nodejs && \

# Clone and setup
git clone https://github.com/your-org/uatu-audit.git && \
cd uatu-audit && \
npm install && \

# Build Docker images
docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest . && \
docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest . && \
docker build -f docker/move.Dockerfile -t uatu-audit-move:latest . && \

# Build and verify
npm run build && \
node dist/bin/uatu.js tools && \

echo "✅ Server setup complete! Start with: npm run dev"
```

---

## 📚 Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Security:** https://docs.docker.com/engine/security/
- **Rootless Docker:** https://docs.docker.com/engine/security/rootless/
- **UFW Guide:** https://help.ubuntu.com/community/UFW
- **SELinux Guide:** https://wiki.centos.org/HowTos/SELinux
- **systemd Service:** https://www.freedesktop.org/software/systemd/man/systemd.service.html

---

**Status:** ✅ Server deployment fully supported
**Last Updated:** January 16, 2026
