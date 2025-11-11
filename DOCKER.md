# Docker Setup for UatuAudit

## Quick Start

```bash
# Build and start the service
docker-compose up --build

# View logs
docker-compose logs -f

# Run a sample audit
docker-compose exec uatu pnpm run run:sample

# Stop the service
docker-compose down
```

## Configuration

1. **Environment Variables**
   Copy `.env.example` to `.env` in the project root:
   ```bash
   cp env.example .env
   ```
   Edit `.env` to add your credentials:
   ```env
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback
   ANTHROPIC_API_KEY=your_key  # Optional for AI features
   ```

2. **Persistent Storage**
   Data is stored in a named volume `uatu_data`. To backup:
   ```bash
   docker volume inspect uatu_data  # Get mount point
   # Backup the volume data
   ```

## Common Commands

```bash
# Rebuild container
docker-compose build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down

# Check container status
docker-compose ps

# Execute command in container
docker-compose exec uatu bash

# Run an audit
docker-compose exec uatu pnpm run run:sample

# View volume data
docker volume ls
```

## Troubleshooting

1. **Port Conflict**
   If port 9090 is in use, edit `docker-compose.yml`:
   ```yaml
   ports:
     - "8080:9090"  # Change 8080 to any free port
   ```

2. **Permission Issues**
   ```bash
   # Fix volume permissions
   docker-compose down
   docker volume rm uatu_data
   docker-compose up -d
   ```

3. **Container Crashes**
   ```bash
   # View logs
   docker-compose logs -f
   
   # Restart container
   docker-compose restart
   ```

## Resource Management

Edit `docker-compose.yml` to adjust resource limits:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'     # Use 2 CPU cores
      memory: 2G    # Use 2GB RAM
```

## Development with Docker

1. **Live Development**
   ```bash
   # Build with development features
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

2. **Running Tests**
   ```bash
   docker-compose exec uatu pnpm test
   ```

3. **Viewing Logs**
   ```bash
   docker-compose exec uatu tail -f /root/.uatu/workspace/latest/execute.log
   ```
