# Getting Started with UatuAudit

## Prerequisites

1. **Node.js Environment**
   ```bash
   # Check Node.js version (requires 18+)
   node --version   # Should be 18.x or higher
   
   # Install pnpm if not present
   npm install -g pnpm
   ```

2. **System Requirements**
   - Node.js 18+ (recommended: 20 LTS)
   - pnpm package manager
   - Git
   - (Optional) Docker for sandbox execution
   - Disk space: ~500MB for initial setup

## Initial Setup

1. **Clone & Install Dependencies**
   ```bash
   # Clone repository
   git clone https://github.com/wasserstoff-india/UatuAudit.git
   cd UatuAudit

   # Install dependencies
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp env.example .env

   # Edit .env with your settings
   vi .env   # or use any editor
   ```

   Required environment variables:
   ```env
   # Core Settings
   UATU_PORT=9090                  # HTTP server port
   UATU_CONCURRENCY=4              # Number of workers
   UATU_HOME=/Users/yourusername/.uatu

   # GitHub Integration (for private repos)
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback

   # Optional: AI Enhancement
   ANTHROPIC_API_KEY=your_key      # For AI features

   # Optional: Security
   UATU_SANDBOX=docker             # Use Docker sandbox
   UATU_EXECUTE_TIMEOUT_MS=900000  # 15 min timeout
   ```

3. **Build Project**
   ```bash
   # Build TypeScript
   pnpm build
   
   # Verify build
   ls dist/  # Should see compiled .js files
   ```

## Start the Service

1. **Start Daemon**
   ```bash
   # Start in foreground
   uatu daemon

   # Expected output:
   # 🚀 Starting Uatu daemon on port 9090 with 4 workers
   # 📡 HTTP server listening on http://localhost:9090
   ```

2. **Verify Installation**
   ```bash
   # Check daemon health
   curl http://localhost:9090/healthz

   # Should return:
   # {"ok":true,"timestamp":"...","checks":{"queueReadable":true,...}}
   ```

## Run Your First Audit

1. **Simple Public Repository Audit**
   ```bash
   # Run audit on a public repo
   uatu run \
     --repo https://github.com/your-test-repo.git \
     --project test-project \
     --branch main
   ```

2. **Monitor Progress**
   - Open browser: http://localhost:9090
   - Watch progress in terminal
   - Check logs: `$UATU_HOME/workspace/users/$USER/projects/test-project/branches/main/runs/latest/execute.log`

3. **View Results**
   ```bash
   # Generate PDF report (optional)
   node scripts/generate-pdf.js test-project main
   
   # View report in browser
   open http://localhost:9090/report?project=test-project&branch=main&format=html
   ```

## Common Issues & Solutions

1. **Port Already in Use**
   ```bash
   # Change port in .env
   UATU_PORT=9091  # Or another free port
   ```

2. **Permission Issues**
   ```bash
   # Fix UATU_HOME permissions
   mkdir -p $UATU_HOME
   chmod 755 $UATU_HOME
   ```

3. **GitHub Authentication**
   ```bash
   # Remove stored token to re-authenticate
   rm $UATU_HOME/users/$USER/secrets/github.json
   # Then restart daemon and authenticate via UI
   ```

4. **Build Issues**
   ```bash
   # Clean and rebuild
   rm -rf dist/
   rm -rf node_modules/
   pnpm install
   pnpm build
   ```

## Verification Checklist

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Dependencies installed
- [ ] .env configured
- [ ] Build successful
- [ ] Daemon starts
- [ ] Health check passes
- [ ] Test audit runs
- [ ] Reports generate

## Next Steps

1. **Configure GitHub OAuth**
   - Create GitHub OAuth App
   - Add credentials to .env
   - Test private repository access

2. **Enable Docker Sandbox**
   ```bash
   # Update .env
   UATU_SANDBOX=docker
   
   # Test Docker setup
   docker run hello-world
   ```

3. **Enable AI Features**
   ```bash
   # Add Anthropic key to .env
   ANTHROPIC_API_KEY=your_key
   
   # Run audit with AI
   uatu run --repo url --project name --branch main --ai
   ```

## Development Tips

- Use `pnpm test` to run unit tests
- Check `src/__tests__` for test examples
- Monitor `execute.log` for detailed audit logs
- Use `UATU_HOME` env var to change workspace location
- Keep daemon running in a separate terminal while developing

## Support & Troubleshooting

- Check daemon logs for errors
- Verify file permissions in UATU_HOME
- Ensure all required env vars are set
- Try cleaning and rebuilding on updates
- Check GitHub token permissions
- Verify Docker if using sandbox mode
