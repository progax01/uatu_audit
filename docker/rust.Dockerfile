FROM rust:1.83

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Anchor (may take 10-15 minutes)
RUN cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked || echo "Warning: Anchor installation failed, skipping"

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install cargo-clippy (linter)
RUN rustup component add clippy

# Install cargo-audit (security vulnerabilities)
RUN cargo install cargo-audit || echo "Warning: cargo-audit installation failed, skipping"

# Install cargo-geiger (unsafe code detector)
RUN cargo install cargo-geiger || echo "Warning: cargo-geiger installation failed, skipping"

# Install Soteria (Solana security scanner)
RUN cargo install soteria || echo "Warning: soteria installation failed, skipping"

# Create audit workspace
RUN mkdir -p /audit/source /audit/output
WORKDIR /audit/source

ENV AUDIT_MODE=docker

HEALTHCHECK --interval=30s --timeout=3s \
  CMD anchor --version && cargo --version || exit 1

CMD ["/bin/bash"]
