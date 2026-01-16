FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libssl-dev \
    pkg-config \
    python3 \
    clang \
    llvm \
    libclang-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Aptos CLI (lightweight)
RUN curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3 || echo "Warning: Aptos installation failed, skipping"
ENV PATH="/root/.local/bin:${PATH}"

# Note: Sui CLI and Move Prover are very resource-intensive to build
# They are skipped to reduce build time and memory requirements
# For production use, consider building them separately with more resources

# Create audit workspace
RUN mkdir -p /audit/source /audit/output
WORKDIR /audit/source

ENV AUDIT_MODE=docker

HEALTHCHECK --interval=30s --timeout=3s \
  CMD aptos --version || exit 1

CMD ["/bin/bash"]
