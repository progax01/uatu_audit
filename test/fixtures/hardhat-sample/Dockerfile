FROM node:20-slim AS builder

# Minimal builder for the hardhat sample: use npm to avoid pnpm lockfile issues
WORKDIR /build

# Install build essentials
RUN apt-get update && apt-get install -y git python3 build-essential ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package and install
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source and run Hardhat compile
COPY . .
RUN npx hardhat compile || true

FROM node:20-slim
WORKDIR /app

# Copy built workspace from builder
COPY --from=builder /build /app

# Default command prints the node_modules/.bin listing so build verification is easy
CMD ["bash", "-lc", "ls -la /app/node_modules/.bin || true; echo 'done'"]
