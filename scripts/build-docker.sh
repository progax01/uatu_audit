#!/bin/bash

# Build Docker Images for Uatu Audit
# This script builds all ecosystem-based Docker images for security tools

set -e

echo "============================================================"
echo "UATU AUDIT - DOCKER IMAGE BUILD SCRIPT"
echo "============================================================"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo ""
    echo "Please start Docker Desktop and try again:"
    echo "  - macOS: Open Docker.app from Applications"
    echo "  - Linux: sudo systemctl start docker"
    echo "  - Windows: Start Docker Desktop"
    echo ""
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Parse arguments
BUILD_ALL=true
BUILD_SOLIDITY=false
BUILD_RUST=false
BUILD_MOVE=false
BUILD_PARALLEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --solidity)
            BUILD_SOLIDITY=true
            BUILD_ALL=false
            ;;
        --rust)
            BUILD_RUST=true
            BUILD_ALL=false
            ;;
        --move)
            BUILD_MOVE=true
            BUILD_ALL=false
            ;;
        --parallel)
            BUILD_PARALLEL=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --solidity    Build only Solidity tools image"
            echo "  --rust        Build only Rust/Solana tools image"
            echo "  --move        Build only Move tools image"
            echo "  --parallel    Build images in parallel (faster but more resource intensive)"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Build all images"
            echo "  $0 --solidity         # Build only Solidity image"
            echo "  $0 --parallel         # Build all images in parallel"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
    shift
done

# Build function
build_image() {
    local service=$1
    local name=$2

    echo "🔨 Building $name..."
    echo "   This may take 5-10 minutes on first build..."
    echo ""

    if docker-compose build $service; then
        echo ""
        echo "✅ $name built successfully"
        echo ""
    else
        echo ""
        echo "❌ Failed to build $name"
        echo ""
        return 1
    fi
}

# Main build logic
if [ "$BUILD_ALL" = true ]; then
    if [ "$BUILD_PARALLEL" = true ]; then
        echo "Building ALL images in PARALLEL..."
        echo ""
        docker-compose build --parallel
        echo ""
        echo "✅ All images built successfully"
    else
        echo "Building ALL images sequentially..."
        echo ""
        build_image "audit-solidity" "Solidity Tools"
        build_image "audit-rust" "Rust/Solana Tools"
        build_image "audit-move" "Move Tools"
        echo "✅ All images built successfully"
    fi
else
    if [ "$BUILD_SOLIDITY" = true ]; then
        build_image "audit-solidity" "Solidity Tools"
    fi

    if [ "$BUILD_RUST" = true ]; then
        build_image "audit-rust" "Rust/Solana Tools"
    fi

    if [ "$BUILD_MOVE" = true ]; then
        build_image "audit-move" "Move Tools"
    fi
fi

echo ""
echo "============================================================"
echo "BUILD COMPLETE"
echo "============================================================"
echo ""
echo "Verify images:"
echo "  docker images | grep uatu-audit"
echo ""
echo "Check tool availability:"
echo "  npm run build && node dist/bin/uatu.js tools"
echo ""
echo "Test a specific tool:"
echo "  docker run --rm uatu-audit-solidity:latest slither --version"
echo ""
