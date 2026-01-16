FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (needed for foundry)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Foundry (forge, cast, anvil)
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

# Add Foundry to PATH
ENV PATH="/root/.foundry/bin:${PATH}"

# Install Slither
RUN pip3 install slither-analyzer

# Install Mythril (requires Rust build tools)
# First install maturin and other build dependencies
RUN pip3 install maturin setuptools-rust
RUN pip3 install mythril || echo "Warning: Mythril installation failed, skipping"

# Install Semgrep
RUN pip3 install semgrep

# Install Hardhat globally
RUN npm install -g hardhat

# Install Solc versions (0.7.6, 0.8.0, 0.8.20, latest)
RUN pip3 install solc-select && \
    solc-select install 0.7.6 && \
    solc-select install 0.8.0 && \
    solc-select install 0.8.20 && \
    solc-select install 0.8.24

# Create audit workspace
RUN mkdir -p /audit/source /audit/output
WORKDIR /audit/source

# Set environment variable
ENV AUDIT_MODE=docker

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD slither --version && forge --version || exit 1

# Default to shell for debugging
CMD ["/bin/bash"]
