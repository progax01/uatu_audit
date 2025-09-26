# SOP Implementation for Deterministic Sandbox Deployment & Execution

This document describes the implementation of the comprehensive SOP pack for UatuAudit's sandbox deployment and execution system.

## ✅ Implemented SOPs

### SOP-10: Sandbox Provision ✅
**File:** `src/services/sandboxProvisioner.ts`

- ✅ Creates ephemeral sandbox directory under `runs/{ts}/sandbox/`
- ✅ Selective copy excluding `.git`, `node_modules`, `runs`, `.uatu/ai_tests/*.plan.txt`
- ✅ Toolchain detection (Foundry, Hardhat, Anchor, Soroban, Node)
- ✅ Claude CLI capability probing with permission flags
- ✅ Execution manifest generation with environment snapshot
- ✅ Disk space validation
- ✅ Progress tracking

### SOP-20: Dependencies Materialization ✅
**File:** `src/sops/executeEnhanced.ts` (function: `installNodeDependencies`)

- ✅ Smart package manager detection (npm, yarn, pnpm)
- ✅ Lockfile-based installation (`npm ci`, `yarn install --frozen-lockfile`)
- ✅ Network retry logic (1 retry with backoff)
- ✅ Error insights generation for dependency failures

### SOP-30: Compile ✅
**File:** `src/sops/executeEnhanced.ts` (function: `compileProject`)

- ✅ Multi-framework compilation (Foundry, Hardhat, Anchor, Soroban)
- ✅ Compile failure insights with suggested remediation
- ✅ No source code mutation (insights only)
- ✅ Continues execution on failure

### SOP-40: Test Execution ✅
**File:** `src/sops/executeEnhanced.ts` (function: `runTests`)

- ✅ Framework-specific test execution
- ✅ Timeout enforcement via `EXECUTE_TIMEOUT_MS`
- ✅ Test failure insights generation
- ✅ Output capture and logging

### SOP-50: AI Test Generation (Claude) ✅
**File:** `src/services/claudeTestGenerator.ts`

- ✅ Non-destructive test generation in `.uatu/ai_tests/`
- ✅ Behavioral and STRIDE test styles
- ✅ Sandbox-mode Claude CLI integration
- ✅ Project context building (inventory, analysis, tree)
- ✅ Executable test skeleton generation
- ✅ Test plan metrics generation

### SOP-60: Insight Generation ✅
**File:** `src/services/insightGenerator.ts`

- ✅ Actionable insights without code mutation
- ✅ Structured insight templates (Evidence, Root Cause, Remediation)
- ✅ Priority classification (Critical, High, Medium, Low)
- ✅ Markdown and JSON output formats
- ✅ Error pattern recognition for common issues

### SOP-70: Coverage Harvest ✅
**File:** `src/sops/executeEnhanced.ts` (function: `harvestCoverage`)

- ✅ Multi-framework coverage collection
- ✅ Safe extglob usage for Hardhat
- ✅ Coverage normalization (`coverage.norm.json`)
- ✅ Best-effort approach (non-blocking failures)

## 🔧 Enhanced Claude Integration

### Sandbox Permissions
```bash
claude --print \
  --dangerously-skip-permissions \
  --permission-mode sandboxBashMode \
  --allowed-tools "Bash Edit Read Write"
```

### Configuration Options
```bash
# Environment Variables
CLAUDE_CLI_PATH=/path/to/claude
CLAUDE_TIMEOUT_MS=300000  # 5 minutes for AI operations
CLAUDE_SANDBOX_MODE=true
UATU_EXECUTE_TIMEOUT_MS=900000  # 15 minutes for tests
UATU_CLEANUP_SANDBOX=true  # Auto-cleanup sandbox
```

## 📊 Key Features

### Deterministic Execution
- ✅ Isolated sandbox environments
- ✅ Read-only source repository policy
- ✅ Reproducible builds and tests
- ✅ Complete audit trail

### Error Recovery
- ✅ 1 retry for transient network failures
- ✅ 0 retries for logical/compiler errors
- ✅ Comprehensive error insights
- ✅ Graceful degradation (continue on non-critical failures)

### AI Integration
- ✅ Context-aware test generation
- ✅ Security-focused STRIDE testing
- ✅ Behavioral workflow testing
- ✅ Executable test skeletons

### Observability
- ✅ Progress tracking with weighted percentages
- ✅ Detailed logging (`execute.log`, `cli.log`)
- ✅ Structured insights (`insights.md`, `insights.json`)
- ✅ Coverage metrics normalization

## 🚀 Usage Example

### Basic Integration
```typescript
import { executeEnhancedSOP } from './sops/executeEnhanced.js';
import { ClaudeTestGenerator } from './services/claudeTestGenerator.js';

// Run enhanced execution SOP
const result = await executeEnhancedSOP.execute({
  projectPath: '/path/to/project',
  runsPath: '/path/to/runs',
  timestamp: '2025-09-26'
}, progressCallback);

// Generate AI tests if needed
if (result.success && result.outputs?.toolchain) {
  const testGenerator = new ClaudeTestGenerator(runPath, insights);
  const testResult = await testGenerator.generateTests({
    sandboxPath: result.outputs.sandboxPath,
    runPath,
    inventoryPath: 'inventory.json',
    analysisPath: 'analysis.json',
    testStyles: ['behavioral', 'stride'],
    securityFocus: true
  }, result.outputs.toolchain);
}
```

### Integration with Existing Daemon
Replace `executeSOP` calls with `executeEnhancedSOP` in:
- `src/daemon/daemon.ts`
- `src/services/runAll.ts`

## 📈 Benefits Achieved

1. **Deterministic Builds**: Every execution is reproducible and isolated
2. **Enhanced Error Handling**: Actionable insights instead of cryptic errors
3. **AI-Powered Testing**: Claude generates executable security tests
4. **Non-Destructive**: Never modifies source code, only provides suggestions
5. **Comprehensive Coverage**: Multi-framework support with normalized metrics
6. **Operational Resilience**: Robust retry logic and graceful degradation

## 🔍 Monitoring & Debugging

### Key Files to Monitor
- `runs/{timestamp}/execute.log` - Main execution log
- `runs/{timestamp}/cli.log` - Command execution details
- `runs/{timestamp}/insights.md` - Human-readable insights
- `runs/{timestamp}/sandbox/manifest.json` - Execution context
- `.uatu/ai_tests/` - Generated test files

### Common Issues & Solutions
- **Claude CLI Timeouts**: Increase `CLAUDE_TIMEOUT_MS` or check permissions
- **Dependency Failures**: Check network connectivity and package-lock.json
- **Compilation Errors**: Review insights.md for suggested fixes
- **Coverage Issues**: Verify test framework configuration

## 🎯 Next Steps

1. **Gradual Rollout**: Test enhanced SOP on smaller projects first
2. **Metrics Collection**: Monitor execution times and success rates
3. **Insight Refinement**: Improve error pattern recognition
4. **Claude Prompts**: Optimize test generation prompts based on results
5. **Performance Tuning**: Adjust timeouts based on real-world usage

The implementation follows the deterministic SOP pack specifications while maintaining compatibility with existing UatuAudit infrastructure.
