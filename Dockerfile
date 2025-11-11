# Multi-stage build for optimal image size and security
FROM node:20-slim AS builder

# Build argument: set to 'true' to run the deterministic compile (Hardhat/Foundry) in the builder stage.
ARG BUILD_COMPILE=false

# Install essential build dependencies
RUN apt-get update && apt-get install -y \
        git \
        python3 \
        build-essential \
        ca-certificates \
        && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Configure npm to use exact versions and ignore engine restrictions
RUN npm config set save-exact=true && \
        npm config set engine-strict=false

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including devDependencies so we can compile in builder)
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Optionally run deterministic compile for smart-contract projects inside the builder.
# This uses the installed node_modules and will execute only when BUILD_COMPILE=true.
RUN if [ "$BUILD_COMPILE" = "true" ] ; then \
            echo "Running deterministic compile in builder (BUILD_COMPILE=true)" ; \
            # If Hardhat is present, run the local binary to compile; otherwise try foundry or skip
            if [ -f package.json ] && grep -q "hardhat" package.json ; then \
                echo "Detected Hardhat in package.json; running ./node_modules/.bin/hardhat compile" ; \
                ./node_modules/.bin/hardhat compile || echo "Hardhat compile failed" ; \
            else \
                echo "No Hardhat detected or compile not necessary" ; \
            fi ; \
        fi

# Production stage
FROM node:20-slim

# Install minimal runtime packages + Docker CLI for docker-compose separation
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally in production image
RUN npm install -g pnpm@latest

# Set working directory
WORKDIR /app

# Copy built files and production dependencies from builder
# We copy node_modules from the builder but prune dev deps to keep image small.
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy node_modules from builder into final image. Using COPY preserves symlinks and ensures runtime deps like dotenv are available.
COPY --from=builder /build/node_modules ./node_modules

# Copy static assets
COPY --from=builder /build/index.html ./index.html
COPY --from=builder /build/src/templates ./src/templates

# Create uatu data directory
RUN mkdir -p /root/.uatu

# Set environment variables
ENV NODE_ENV=production \
    PORT=9090

# Expose port
EXPOSE 9090

# Create volume mount point
VOLUME ["/root/.uatu"]

# Set default env vars
ENV UATU_PORT=9090 \
    UATU_HOME=/root/.uatu \
    SKIP_NODE_VERSION_CHECK=true

# Start daemon
CMD ["pnpm", "run", "daemon"]
