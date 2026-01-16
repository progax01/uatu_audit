#!/bin/bash

# Uatu Audit - Server Installation Script
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+

set -e

echo "================================================"
echo "  Uatu Audit - Server Installation"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS $VER${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Running as root. Will create 'uatu' user.${NC}"
    CREATE_USER=true
else
    echo -e "${GREEN}Running as non-root user: $USER${NC}"
    CREATE_USER=false
fi

echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Docker
install_docker() {
    echo "📦 Installing Docker..."

    if command_exists docker; then
        echo -e "${GREEN}✓ Docker already installed${NC}"
        docker --version
    else
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io
            sudo systemctl start docker
            sudo systemctl enable docker
        else
            echo -e "${RED}Unsupported OS for automatic Docker installation${NC}"
            echo "Please install Docker manually: https://docs.docker.com/engine/install/"
            exit 1
        fi

        echo -e "${GREEN}✓ Docker installed successfully${NC}"
    fi

    # Add user to docker group (if not root)
    if [ "$CREATE_USER" = false ]; then
        echo "Adding $USER to docker group..."
        sudo usermod -aG docker $USER || true
    fi

    echo ""
}

# Install Node.js
install_nodejs() {
    echo "📦 Installing Node.js..."

    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js already installed: $NODE_VERSION${NC}"
    else
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
            curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        else
            echo -e "${RED}Unsupported OS for automatic Node.js installation${NC}"
            echo "Please install Node.js manually: https://nodejs.org/"
            exit 1
        fi

        echo -e "${GREEN}✓ Node.js installed successfully${NC}"
        node --version
        npm --version
    fi

    echo ""
}

# Install Git
install_git() {
    echo "📦 Installing Git..."

    if command_exists git; then
        echo -e "${GREEN}✓ Git already installed${NC}"
        git --version
    else
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            sudo apt-get update
            sudo apt-get install -y git
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
            sudo yum install -y git
        fi

        echo -e "${GREEN}✓ Git installed successfully${NC}"
    fi

    echo ""
}

# Check system requirements
check_requirements() {
    echo "🔍 Checking system requirements..."

    # Check CPU cores
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -lt 4 ]; then
        echo -e "${YELLOW}⚠ Warning: Only $CPU_CORES CPU cores detected. Recommended: 4+${NC}"
    else
        echo -e "${GREEN}✓ CPU cores: $CPU_CORES${NC}"
    fi

    # Check RAM
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 8 ]; then
        echo -e "${YELLOW}⚠ Warning: Only ${TOTAL_RAM}GB RAM detected. Recommended: 8GB+${NC}"
    else
        echo -e "${GREEN}✓ RAM: ${TOTAL_RAM}GB${NC}"
    fi

    # Check disk space
    DISK_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$DISK_SPACE" -lt 30 ]; then
        echo -e "${YELLOW}⚠ Warning: Only ${DISK_SPACE}GB disk space available. Recommended: 30GB+${NC}"
    else
        echo -e "${GREEN}✓ Disk space: ${DISK_SPACE}GB${NC}"
    fi

    echo ""
}

# Configure firewall
configure_firewall() {
    echo "🔥 Configuring firewall..."

    if command_exists ufw; then
        echo "Configuring UFW..."
        sudo ufw allow 22/tcp || true
        sudo ufw allow 9091/tcp || true
        echo -e "${GREEN}✓ UFW configured${NC}"
    elif command_exists firewall-cmd; then
        echo "Configuring firewalld..."
        sudo firewall-cmd --permanent --add-port=9091/tcp || true
        sudo firewall-cmd --reload || true
        echo -e "${GREEN}✓ Firewalld configured${NC}"
    else
        echo -e "${YELLOW}⚠ No firewall detected. Please configure manually.${NC}"
    fi

    echo ""
}

# Clone and setup application
setup_application() {
    echo "📥 Setting up Uatu Audit..."

    # Determine installation directory
    if [ "$CREATE_USER" = true ]; then
        INSTALL_DIR="/opt/uatu-audit"
        sudo mkdir -p $INSTALL_DIR
    else
        INSTALL_DIR="$HOME/uatu-audit"
    fi

    # Check if directory exists
    if [ -d "$INSTALL_DIR/.git" ]; then
        echo "Repository already exists. Pulling latest changes..."
        cd $INSTALL_DIR
        git pull
    else
        echo "Cloning repository..."
        # Replace with your actual repository URL
        git clone https://github.com/your-org/uatu-audit.git $INSTALL_DIR || \
        (echo -e "${YELLOW}⚠ Git clone failed. Please clone manually.${NC}" && \
         echo "Using current directory instead..." && \
         INSTALL_DIR=$(pwd))
    fi

    cd $INSTALL_DIR

    echo -e "${GREEN}✓ Repository ready at: $INSTALL_DIR${NC}"
    echo ""
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing Node.js dependencies..."

    npm install

    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
}

# Build Docker images
build_docker_images() {
    echo "🐳 Building Docker images (this may take 20-30 minutes)..."
    echo ""

    # Build Solidity image
    echo "Building Solidity image..."
    docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest . || \
        echo -e "${RED}✗ Solidity image build failed${NC}"

    # Build Rust image
    echo "Building Rust image..."
    docker build -f docker/rust.Dockerfile -t uatu-audit-rust:latest . || \
        echo -e "${RED}✗ Rust image build failed${NC}"

    # Build Move image
    echo "Building Move image..."
    docker build -f docker/move.Dockerfile -t uatu-audit-move:latest . || \
        echo -e "${RED}✗ Move image build failed${NC}"

    echo ""
    echo -e "${GREEN}✓ Docker images built${NC}"
    echo ""
}

# Build application
build_application() {
    echo "🔨 Building application..."

    npm run build

    echo -e "${GREEN}✓ Application built${NC}"
    echo ""
}

# Verify installation
verify_installation() {
    echo "✅ Verifying installation..."

    # Check Docker images
    echo "Docker images:"
    docker images | grep uatu-audit || echo -e "${YELLOW}⚠ No Docker images found${NC}"
    echo ""

    # Check tool availability
    echo "Tool availability:"
    node dist/bin/uatu.js tools || echo -e "${YELLOW}⚠ Tool check failed${NC}"
    echo ""
}

# Create systemd service
create_systemd_service() {
    if [ "$CREATE_USER" = true ]; then
        echo "Creating systemd service..."

        sudo tee /etc/systemd/system/uatu-audit.service > /dev/null <<EOF
[Unit]
Description=Uatu Audit Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=uatu
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

# Resource limits
MemoryLimit=8G
CPUQuota=400%

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload

        echo -e "${GREEN}✓ Systemd service created${NC}"
        echo "  Start with: sudo systemctl start uatu-audit"
        echo "  Enable on boot: sudo systemctl enable uatu-audit"
        echo ""
    fi
}

# Main installation flow
main() {
    echo "Starting installation..."
    echo ""

    check_requirements
    install_git
    install_docker
    install_nodejs
    configure_firewall
    setup_application
    install_dependencies
    build_docker_images
    build_application
    verify_installation
    create_systemd_service

    echo ""
    echo "================================================"
    echo -e "${GREEN}✅ Installation Complete!${NC}"
    echo "================================================"
    echo ""
    echo "📝 Next steps:"
    echo ""
    echo "1. Configure environment variables:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    echo ""
    echo "2. Start the application:"
    echo "   npm run dev"
    echo ""
    echo "3. Visit: http://$(hostname -I | awk '{print $1}'):9091"
    echo ""
    echo "4. Check tool availability:"
    echo "   node dist/bin/uatu.js tools"
    echo ""

    if [ "$CREATE_USER" = false ]; then
        echo -e "${YELLOW}⚠ Important: You may need to log out and log back in for Docker group changes to take effect.${NC}"
        echo ""
    fi

    echo "📚 Documentation: docs/SERVER_DEPLOYMENT.md"
    echo ""
}

# Run main installation
main
