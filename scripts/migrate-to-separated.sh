#!/bin/bash
# =============================================================================
# UatuAudit Docker Separation Migration Script
# =============================================================================
# This script automates the migration from socket-mount to separated services
#
# Usage:
#   ./scripts/migrate-to-separated.sh [OPTIONS]
#
# Options:
#   --backup-only    Only create backups, don't migrate
#   --no-backup      Skip backup step (not recommended)
#   --dry-run        Show what would be done without doing it
#   --with-tls       Enable TLS configuration (requires certificates)
#   --with-proxy     Enable docker-socket-proxy (recommended for production)
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
BACKUP=true
DRY_RUN=false
WITH_TLS=false
WITH_PROXY=false
BACKUP_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --backup-only)
      BACKUP_ONLY=true
      shift
      ;;
    --no-backup)
      BACKUP=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --with-tls)
      WITH_TLS=true
      shift
      ;;
    --with-proxy)
      WITH_PROXY=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
  log_info "Checking requirements..."

  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi

  # Check docker-compose
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed"
    exit 1
  fi

  # Check if docker-compose.yml exists
  if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml not found in current directory"
    exit 1
  fi

  # Check if separated config exists
  if [ ! -f "docker-compose.separated.yml" ]; then
    log_error "docker-compose.separated.yml not found"
    log_info "Please ensure docker-compose.separated.yml is present"
    exit 1
  fi

  log_success "All requirements met"
}

create_backup() {
  log_info "Creating backup..."

  BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"

  # Backup docker-compose files
  if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml "$BACKUP_DIR/"
    log_success "Backed up docker-compose.yml"
  fi

  if [ -f ".env" ]; then
    cp .env "$BACKUP_DIR/"
    log_success "Backed up .env"
  fi

  # Backup data volume
  log_info "Backing up uatu_data volume (this may take a few minutes)..."
  if docker volume inspect uatu_data &> /dev/null; then
    docker run --rm \
      -v uatu_data:/data:ro \
      -v "$(pwd)/$BACKUP_DIR":/backup \
      alpine tar czf /backup/uatu-data-backup.tar.gz -C /data . 2>/dev/null || true
    log_success "Backed up uatu_data volume"
  else
    log_warning "uatu_data volume not found, skipping volume backup"
  fi

  log_success "Backup completed: $BACKUP_DIR"
  echo "$BACKUP_DIR" > .last-backup
}

stop_services() {
  log_info "Stopping current services..."

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would run: docker-compose down"
    return
  fi

  if docker-compose ps | grep -q Up; then
    docker-compose down
    log_success "Services stopped"
  else
    log_info "No running services found"
  fi
}

deploy_new_config() {
  log_info "Deploying new configuration..."

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would copy docker-compose.separated.yml to docker-compose.yml"
    return
  fi

  # Move old config
  if [ -f "docker-compose.yml" ]; then
    mv docker-compose.yml docker-compose.yml.old
    log_info "Moved old docker-compose.yml to docker-compose.yml.old"
  fi

  # Copy new config
  cp docker-compose.separated.yml docker-compose.yml
  log_success "New configuration deployed"

  # Modify config based on options
  if $WITH_TLS; then
    log_info "Enabling TLS configuration..."
    # Uncomment TLS sections in docker-compose.yml
    sed -i 's/# - DOCKER_TLS_VERIFY=1/- DOCKER_TLS_VERIFY=1/g' docker-compose.yml
    sed -i 's/# - DOCKER_CERT_PATH/- DOCKER_CERT_PATH/g' docker-compose.yml
    sed -i 's/# - DOCKER_TLS_CERTDIR/- DOCKER_TLS_CERTDIR/g' docker-compose.yml
    log_success "TLS configuration enabled"
  fi

  if $WITH_PROXY; then
    log_info "Enabling docker-socket-proxy..."
    # Uncomment proxy section
    sed -i 's/# docker-proxy:/docker-proxy:/g' docker-compose.yml
    sed -i 's/#   image: tecnativa/  image: tecnativa/g' docker-compose.yml
    log_success "Docker-socket-proxy enabled"
  fi
}

start_services() {
  log_info "Starting new services..."

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would run: docker-compose up -d"
    return
  fi

  docker-compose up -d
  log_success "Services started"
}

wait_for_health() {
  log_info "Waiting for services to become healthy..."

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would wait for health checks"
    return
  fi

  local max_attempts=30
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    local healthy=true

    # Check docker-dind health
    if ! docker-compose ps | grep docker-dind | grep -q "healthy"; then
      healthy=false
    fi

    # Check uatu health (if running)
    if docker-compose ps | grep uatu | grep -q "Up"; then
      if ! docker-compose ps | grep uatu | grep -q "healthy"; then
        healthy=false
      fi
    fi

    if $healthy; then
      log_success "All services are healthy"
      return 0
    fi

    log_info "Waiting for services to become healthy (attempt $attempt/$max_attempts)..."
    sleep 10
    attempt=$((attempt + 1))
  done

  log_error "Services did not become healthy in time"
  return 1
}

verify_connection() {
  log_info "Verifying Docker connection..."

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would verify Docker connection"
    return
  fi

  # Test docker-dind directly
  if docker exec uatu-docker docker info &> /dev/null; then
    log_success "docker-dind is working"
  else
    log_error "docker-dind is not responding"
    return 1
  fi

  # Test connection from uatu container
  if docker exec uatu-app docker -H tcp://docker-dind:2376 info &> /dev/null; then
    log_success "UatuAudit can connect to docker-dind"
  else
    log_error "UatuAudit cannot connect to docker-dind"
    return 1
  fi

  log_success "All connection tests passed"
}

print_status() {
  log_info "Current status:"
  echo ""
  docker-compose ps
  echo ""

  log_info "To view logs:"
  echo "  docker-compose logs -f uatu"
  echo "  docker-compose logs -f docker-dind"
  echo ""

  log_info "To test audit:"
  echo "  docker exec -it uatu-app node dist/bin/uatu.js run \\"
  echo "    --repo https://github.com/Uniswap/v2-core.git \\"
  echo "    --project uniswap-test \\"
  echo "    --branch master \\"
  echo "    --test-styles behavioral"
  echo ""

  log_info "Web UI available at: http://localhost:9090"
}

rollback() {
  log_error "Migration failed, initiating rollback..."

  if [ -f ".last-backup" ]; then
    local backup_dir=$(cat .last-backup)

    log_info "Stopping new services..."
    docker-compose down

    log_info "Restoring old configuration..."
    if [ -f "$backup_dir/docker-compose.yml" ]; then
      cp "$backup_dir/docker-compose.yml" docker-compose.yml
      log_success "Restored docker-compose.yml"
    fi

    if [ -f "$backup_dir/.env" ]; then
      cp "$backup_dir/.env" .env
      log_success "Restored .env"
    fi

    log_info "Starting old services..."
    docker-compose up -d

    log_success "Rollback completed"
  else
    log_error "No backup found for rollback"
  fi
}

# =============================================================================
# Main execution
# =============================================================================

echo "========================================================================"
echo "  UatuAudit Docker Separation Migration"
echo "========================================================================"
echo ""

if $DRY_RUN; then
  log_warning "Running in DRY-RUN mode (no changes will be made)"
  echo ""
fi

# Check requirements
check_requirements
echo ""

# Create backup
if $BACKUP; then
  create_backup
  echo ""
fi

if $BACKUP_ONLY; then
  log_success "Backup completed (backup-only mode)"
  exit 0
fi

# Stop current services
stop_services
echo ""

# Deploy new configuration
deploy_new_config
echo ""

# Start new services
start_services
echo ""

# Wait for health checks
if wait_for_health; then
  echo ""

  # Verify connection
  if verify_connection; then
    echo ""
    log_success "Migration completed successfully! ✅"
    echo ""
    print_status
    exit 0
  else
    rollback
    exit 1
  fi
else
  rollback
  exit 1
fi
