#!/bin/bash
set -e

# Configure Git credentials if GITHUB_TOKEN is set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "Configuring Git credentials..."
    echo "https://oauth2:${GITHUB_TOKEN}@github.com" > /home/uatu/.git-credentials
    chmod 600 /home/uatu/.git-credentials
fi

# Fix Claude CLI permissions (make fully accessible for all users)
if [ -d "/home/uatu/.claude" ]; then
    echo "Fixing Claude CLI permissions..."
    chmod -R 777 /home/uatu/.claude 2>/dev/null || true
fi

# Execute the CMD from Dockerfile
exec "$@"
