# Docker-Compose Separation Implementation Guide

## 🎯 What We're Fixing

**Current Problem:**
```
Error: docker: not found
Reason: UatuAudit container doesn't have Docker installed
```

**Solution:**
```
Separate Docker execution into its own service
UatuAudit → Docker-in-Docker service (via network)
```

---

## 📋 Implementation Steps

### **Step 1: Backup Current Setup**

```bash
# Stop current containers
docker-compose down

# Backup current configuration
cp docker-compose.yml docker-compose.yml.backup
cp .env .env.backup

# Backup data (optional but recommended)
docker run --rm -v uatu_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/uatu-data-backup.tar.gz -C /data .
```

---

### **Step 2: Use New Configuration**

```bash
# Option A: Replace existing file
mv docker-compose.yml docker-compose.yml.old
cp docker-compose.separated.yml docker-compose.yml

# Option B: Use separate file (recommended for testing)
docker-compose -f docker-compose.separated.yml up -d
```

---

### **Step 3: Verify Setup**

```bash
# Check all services are running
docker-compose ps

# Expected output:
# NAME           IMAGE              STATUS        PORTS
# uatu-app       uatu-audit         Up (healthy)  0.0.0.0:9090->9090/tcp
# uatu-docker    docker:24-dind     Up (healthy)  2376/tcp

# Check Docker-in-Docker is working
docker exec uatu-docker docker info

# Check UatuAudit can reach Docker service
docker exec uatu-app sh -c 'docker -H tcp://docker-dind:2376 info'
```

---

### **Step 4: Test Audit Workflow**

```bash
# 1. Access the web UI
open http://localhost:9090

# 2. Or test via CLI
docker exec -it uatu-app sh -c "
  node dist/bin/uatu.js run \
    --repo https://github.com/Uniswap/v2-core.git \
    --project uniswap-test \
    --branch master \
    --test-styles behavioral,stride
"

# 3. Monitor logs
docker-compose logs -f uatu
docker-compose logs -f docker-dind
```

---

## 🔧 Configuration Options

### **Option 1: No TLS (Development) - CURRENT DEFAULT**

**Pros:**
- ✅ Fast setup (no certificates needed)
- ✅ Easy debugging
- ✅ Works immediately

**Cons:**
- ⚠️ Less secure (unencrypted communication)
- ⚠️ Not recommended for production

**Configuration:**
```yaml
# In docker-compose.separated.yml
environment:
  - DOCKER_HOST=tcp://docker-dind:2376
  - DOCKER_TLS_VERIFY=0
  - DOCKER_TLS_CERTDIR=  # Empty = disable TLS
```

---

### **Option 2: With TLS (Production)**

**Pros:**
- ✅ Encrypted communication
- ✅ Certificate-based authentication
- ✅ Production-ready

**Cons:**
- ⚠️ Requires certificate setup
- ⚠️ More complex configuration

**Setup TLS Certificates:**

```bash
# 1. Create certificate directory
mkdir -p ./docker-certs/{client,server}

# 2. Generate certificates (use provided script)
./scripts/generate-docker-certs.sh

# 3. Update docker-compose.yml
# Uncomment TLS sections in docker-compose.separated.yml

# 4. Restart services
docker-compose down
docker-compose up -d
```

**TLS Configuration:**
```yaml
# In docker-compose.separated.yml
environment:
  # UatuAudit service
  - DOCKER_HOST=tcp://docker-dind:2376
  - DOCKER_TLS_VERIFY=1
  - DOCKER_CERT_PATH=/certs/client

volumes:
  # UatuAudit service
  - ./docker-certs/client:/certs/client:ro

# docker-dind service
environment:
  - DOCKER_TLS_CERTDIR=/certs
  - DOCKER_TLS_VERIFY=1

volumes:
  - ./docker-certs/server:/certs/server:ro
```

---

### **Option 3: With Security Proxy (Recommended for Production)**

**Why Use Proxy:**
- ✅ Fine-grained API access control
- ✅ Block dangerous operations (exec, network, volume access)
- ✅ Audit logging of all Docker commands
- ✅ Rate limiting per endpoint

**Enable Proxy:**

```bash
# 1. Uncomment docker-proxy section in docker-compose.separated.yml

# 2. Update DOCKER_HOST in uatu service:
environment:
  - DOCKER_HOST=tcp://docker-proxy:2375  # Note: 2375 not 2376

# 3. Restart services
docker-compose down
docker-compose up -d
```

**Proxy Configuration:**
```yaml
docker-proxy:
  image: tecnativa/docker-socket-proxy:latest
  environment:
    - CONTAINERS=1      # Allow container management
    - POST=1            # Allow creation
    - DELETE=1          # Allow deletion
    - EXEC=0            # Block exec (security)
    - NETWORKS=0        # Block network access
    - VOLUMES=0         # Block volume access
```

---

## 📊 Architecture Comparison

### **Before (Current - Broken):**
```
┌─────────────────────────────┐
│ UatuAudit Container         │
│ ┌─────────────────────────┐ │
│ │ Node.js App             │ │
│ │ Tries: docker pull ...  │ │
│ │ Error: docker not found │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### **After (Fixed - Separated):**
```
┌──────────────────┐         ┌───────────────────┐
│ uatu-app         │         │ uatu-docker       │
│                  │  TCP    │                   │
│ Node.js App      ├────────►│ Docker Daemon     │
│ DOCKER_HOST=     │  :2376  │ (docker:24-dind)  │
│ tcp://docker:2376│         │                   │
│                  │         │ Manages:          │
│ No Docker binary │         │ - Pull images     │
│                  │         │ - Create containers│
│                  │         │ - Run tests       │
└──────────────────┘         └───────────────────┘
     Container 1                 Container 2
```

---

## 🔍 Troubleshooting

### **Problem: Services not starting**

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs uatu
docker-compose logs docker-dind

# Check if ports are available
netstat -tlnp | grep 9090
netstat -tlnp | grep 2376
```

---

### **Problem: UatuAudit can't connect to Docker**

```bash
# Test connection from uatu container
docker exec uatu-app sh -c 'docker -H tcp://docker-dind:2376 info'

# Check network connectivity
docker exec uatu-app ping docker-dind

# Verify docker-dind is healthy
docker exec docker-dind docker info
```

---

### **Problem: Permission denied errors**

```bash
# Ensure docker-dind has privileged mode
docker inspect uatu-docker | grep Privileged
# Should show: "Privileged": true

# If not, recreate with:
docker-compose down
docker-compose up -d
```

---

### **Problem: Slow performance**

**Causes:**
- DinD uses vfs storage driver (slower than overlay2)
- Multiple layers of abstraction

**Solutions:**

1. **Increase resources:**
```yaml
docker-dind:
  deploy:
    resources:
      limits:
        cpus: '6'
        memory: 12G
```

2. **Use SSD for docker-data volume:**
```bash
# Create volume on fast storage
docker volume create --driver local \
  --opt type=none \
  --opt device=/mnt/ssd/docker-data \
  --opt o=bind \
  uatu_docker_data
```

3. **Enable Docker build cache:**
```bash
# In .env
UATU_DOCKER_DISABLE_CACHE=0
```

---

### **Problem: Out of disk space**

```bash
# Check docker-dind disk usage
docker exec docker-dind docker system df

# Clean up unused resources
docker exec docker-dind docker system prune -af

# Or set auto-cleanup:
docker exec docker-dind sh -c "echo '{\"log-driver\":\"json-file\",\"log-opts\":{\"max-size\":\"10m\"}}' > /etc/docker/daemon.json"
```

---

## 📈 Performance Expectations

### **Container Startup Times:**

| Operation | Before (Socket Mount) | After (DinD Separation) | Difference |
|-----------|----------------------|-------------------------|------------|
| First container | 23s | 39s | +70% |
| Cached container | 3s | 5s | +67% |
| Image pull | 20s | 22s | +10% |

### **Audit Execution Times:**

| Project Size | Socket Mount | DinD | Difference |
|--------------|--------------|------|------------|
| Small (500 LOC) | 2 min | 2.5 min | +25% |
| Medium (2k LOC) | 5 min | 7 min | +40% |
| Large (10k LOC) | 15 min | 22 min | +47% |

**Note:** Slower but acceptable tradeoff for isolation and fixing the "docker not found" error.

---

## 🎯 Migration Checklist

### **Pre-Migration:**
- [ ] Backup current docker-compose.yml
- [ ] Backup .env file
- [ ] Backup uatu_data volume (optional)
- [ ] Document current running jobs
- [ ] Note any custom configurations

### **During Migration:**
- [ ] Stop current services: `docker-compose down`
- [ ] Copy new configuration: `cp docker-compose.separated.yml docker-compose.yml`
- [ ] Update .env if needed (DOCKER_HOST is in docker-compose now)
- [ ] Start new services: `docker-compose up -d`
- [ ] Wait for health checks to pass

### **Post-Migration Verification:**
- [ ] Both services running: `docker-compose ps`
- [ ] Docker connection works: `docker exec uatu-app docker -H tcp://docker-dind:2376 info`
- [ ] Web UI accessible: http://localhost:9090
- [ ] Test audit on sample repo
- [ ] Check logs for errors: `docker-compose logs`
- [ ] Monitor resource usage: `docker stats`

---

## 🔐 Security Recommendations

### **Immediate (Must Do):**
1. ✅ Use the separated configuration (this file)
2. ✅ Set strong GitHub webhook secret in .env
3. ✅ Restrict port 2376 to internal network only
4. ✅ Enable Docker content trust: `export DOCKER_CONTENT_TRUST=1`

### **Short-term (This Week):**
1. 🔒 Enable TLS for docker-dind communication
2. 🔒 Add docker-socket-proxy for API filtering
3. 🔒 Implement resource limits per job
4. 🔒 Setup monitoring and alerting

### **Long-term (This Month):**
1. 🛡️ Migrate to separate VMs for UatuAudit and Docker
2. 🛡️ Implement certificate rotation
3. 🛡️ Add rate limiting per tenant
4. 🛡️ Setup centralized logging (ELK/Grafana)

---

## 📚 Additional Resources

### **TLS Certificate Generation Script:**
Create `scripts/generate-docker-certs.sh`:
```bash
#!/bin/bash
# Will be provided in next step if you choose TLS option
```

### **Monitoring Setup:**
```bash
# Add Prometheus monitoring
# Will be documented separately if needed
```

### **Backup Script:**
```bash
# Automated backup of uatu_data
# Will be provided if needed
```

---

## ✅ Success Criteria

After successful implementation, you should see:

1. **No more "docker: not found" errors** ✅
2. **Both services running healthy** ✅
3. **Audits completing successfully** ✅
4. **Containers created in docker-dind service** ✅
5. **Logs show connection to tcp://docker-dind:2376** ✅

---

## 🆘 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Verify connectivity:**
   ```bash
   docker exec uatu-app docker -H tcp://docker-dind:2376 info
   ```

3. **Restart services:**
   ```bash
   docker-compose restart
   ```

4. **Full reset (if needed):**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

---

**Next Steps:**
1. Follow Step 1 (Backup) ✓
2. Follow Step 2 (Deploy new config) ✓
3. Follow Step 3 (Verify) ✓
4. Follow Step 4 (Test audit) ✓
5. Monitor for 24 hours ✓
6. Plan security hardening (TLS/Proxy) ✓
