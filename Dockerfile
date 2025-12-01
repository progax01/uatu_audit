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

# Build TypeScript backend and React UI
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

# Install minimal runtime packages + Docker CLI + Chromium for Puppeteer PDF generation + build tools for node-pty
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    build-essential \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
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

# Copy built files and package files
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies with native compilation
# Using --no-optional=false ensures all dependencies including native ones are built
RUN pnpm install --frozen-lockfile --prod

# Install node-gyp globally for manual rebuild
RUN npm install -g node-gyp

# Manually rebuild node-pty native bindings
RUN cd /app/node_modules/.pnpm/node-pty@1.0.0/node_modules/node-pty && \
    node-gyp rebuild && \
    echo "✓ Native bindings built successfully" && \
    ls -la build/Release/pty.node

# Copy React UI build
COPY --from=builder /build/dist-ui ./dist-ui

# Copy templates
COPY --from=builder /build/src/templates ./src/templates

# Create non-root user for security and Claude CLI compatibility
# Claude CLI's bypassPermissions mode cannot be used with root privileges
RUN groupadd -r uatu && useradd -r -g uatu -s /bin/bash -m -d /home/uatu uatu

# Copy Claude CLI credentials from host (will be mounted at build time via buildx)
# This avoids permission issues with volume mounts
COPY --chown=uatu:uatu .claude /home/uatu/.claude

# Create uatu data directory and set ownership
RUN mkdir -p /home/uatu/.uatu /home/uatu/.config && \
    chown -R uatu:uatu /home/uatu /app

# Configure Git for uatu user (credentials will be set via environment variable at runtime)
USER uatu
RUN git config --global credential.helper store && \
    git config --global user.email "uatu@audit.xyz" && \
    git config --global user.name "Uatu Audit"
USER root

# Set environment variables
ENV NODE_ENV=production \
    PORT=9090

# Expose port
EXPOSE 9090

# Create volume mount point
VOLUME ["/home/uatu/.uatu"]

# Set default env vars
ENV UATU_PORT=9090 \
    UATU_HOME=/home/uatu/.uatu \
    SKIP_NODE_VERSION_CHECK=true \
    HOME=/home/uatu

# Copy entrypoint script
COPY --chown=uatu:uatu docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER uatu

# Set entrypoint to configure Git credentials at runtime
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start daemon
CMD ["pnpm", "run", "daemon"]
