# Integration Guide - Activating Parallel Audit Features

## Quick Start (5 Minutes)

### Step 1: Verify Feature Flag
```bash
# Check .env file
grep ENABLE_DETAILED_AUDIT .env
# Should show: ENABLE_DETAILED_AUDIT=true
```

### Step 2: Choose Integration Method

#### Option A: Modify Existing SOP (Minimal Changes)

Edit `src/sops/singlePromptAudit.ts` around line 100:

```typescript
// Add import at top
import { executeParallelAudit } from "./parallelAuditExecutor.js";

// In execute() method, replace Claude CLI execution:
const enableDetailed = process.env.ENABLE_DETAILED_AUDIT === "true";

if (enableDetailed) {
  log.info("Running parallel detailed audit");
  const parallelResult = await executeParallelAudit({
    projectPath: i.projectPath as string,
    contextPath: i.contextPath as string,
    runPath,
    jobId: i.jobId as number | undefined,
    onProgress: (update) => {
      onProgress?.({
        phase: "audit",
        step: update.session.toLowerCase().replace(/ /g, '-'),
        pct: 20 + (update.pct * 0.7)
      });
    }
  });

  if (!parallelResult.success) {
    const fallback = process.env.FALLBACK_TO_BASIC === "true";
    if (fallback) {
      log.warn("Parallel audit failed, falling back to basic audit");
      // Fall through to existing executeClaudeCLI logic below
    } else {
      errors.push("Parallel audit failed");
      return { ok: false, outputs: {}, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
    }
  } else {
    // Write combined results
    await fs.writeJson(resultsPath, parallelResult.combined);
    outputs = parallelResult.combined;

    await step(onProgress, { phase: "audit", step: "audit-complete", pct: 100 });

    return {
      ok: true,
      outputs,
      errors: [],
      started_at,
      completed_at: new Date().toISOString(),
      version: this.version
    };
  }
}

// Existing single-session logic continues here (as fallback or if detailed disabled)
```

#### Option B: Create New Wrapper SOP (Recommended)

1. Create `src/sops/detailedAuditSOP.ts`:

```typescript
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { executeParallelAudit } from "./parallelAuditExecutor.js";
import { singlePromptAuditSOP } from "./singlePromptAudit.js";
import { logger } from "../utils/logger.js";
import fs from "fs-extra";
import path from "node:path";

const log = logger.child({ service: "detailed-audit-sop" });

export const detailedAuditSOP: SOP = {
  name: "detailedAudit",
  version: "1.0.0",
  prerequisites: ["bootstrap"],

  async validateInputs(i) {
    return !!(i.projectPath && i.contextPath);
  },

  async execute(i: SOPInputs, onProgress?) {
    const enableDetailed = process.env.ENABLE_DETAILED_AUDIT === "true";
    const runPath = path.join(i.runsPath as string, i.timestamp as string);
    const resultsPath = path.join(i.contextPath as string, "results.json");

    if (!enableDetailed) {
      log.info("Detailed audit disabled, using basic audit");
      return singlePromptAuditSOP.execute(i, onProgress);
    }

    log.info("Running detailed parallel audit");
    const result = await executeParallelAudit({
      projectPath: i.projectPath as string,
      contextPath: i.contextPath as string,
      runPath,
      jobId: i.jobId as number | undefined,
      onProgress: (update) => {
        onProgress?.({
          phase: "audit",
          step: update.session.toLowerCase().replace(/ /g, '-'),
          pct: 20 + (update.pct * 0.7)
        });
      }
    });

    if (!result.success) {
      const fallback = process.env.FALLBACK_TO_BASIC === "true";
      if (fallback) {
        log.warn("Parallel audit failed, falling back to basic audit");
        return singlePromptAuditSOP.execute(i, onProgress);
      } else {
        return {
          ok: false,
          outputs: {},
          errors: ["Parallel audit failed"],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          version: this.version
        };
      }
    }

    // Write combined results
    await fs.writeJson(resultsPath, result.combined);

    return {
      ok: true,
      outputs: result.combined,
      errors: [],
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      version: this.version
    };
  },

  async verifyOutputs(r) {
    return !!(r.outputs && (r.outputs as any).score);
  }
};
```

2. Update `src/services/runAll.ts`:

```typescript
// Change import
import { detailedAuditSOP } from "../sops/detailedAuditSOP.js";

// Replace singlePromptAuditSOP with detailedAuditSOP in execution
const auditResult = await detailedAuditSOP.execute(auditInputs, updateProgress);
```

### Step 3: Test Basic Functionality

```bash
# Disable detailed audit first
echo 'ENABLE_DETAILED_AUDIT=false' >> .env

# Run audit - should work exactly as before
npm run daemon
# Or: npx ts-node src/bin/uatu.ts run --repo <repo-url>

# Verify report generates normally
# Verify certificate generates normally
```

### Step 4: Test Detailed Audit

```bash
# Enable detailed audit
sed -i 's/ENABLE_DETAILED_AUDIT=false/ENABLE_DETAILED_AUDIT=true/' .env

# Run audit with small test project
npx ts-node src/bin/uatu.ts run --repo <small-test-repo>

# Monitor logs - should see 4 sessions starting
# Check run directory for session output files:
#   - security_results.json
#   - contract_explanations.json
#   - user_flows.json
#   - test_execution.json
```

### Step 5: Verify Results

```bash
# Check results.json has new fields
cat ~/.uatu/workspace/users/default/projects/<project>/branches/<branch>/runs/<timestamp>/context/results.json | jq 'keys'

# Should see:
# - contracts_explained
# - test_methodology
# - user_flows
# - test_results
# (in addition to existing fields)
```

## Troubleshooting

### Issue: Sessions timeout
**Solution**: Increase timeout
```bash
SESSION_TIMEOUT_MIN=20  # Increase from 15
```

### Issue: Parallel execution fails
**Solution**: Reduce concurrency
```bash
PARALLEL_SESSIONS=2  # Reduce from 4
```

### Issue: Security session fails
**Solution**: Enable fallback
```bash
FALLBACK_TO_BASIC=true
```

### Issue: Want to disable temporarily
**Solution**: Use feature flag
```bash
ENABLE_DETAILED_AUDIT=false
```

## Monitoring

### View Session Progress

Logs will show:
```
[parallel-audit-executor] Session Security Analysis: executing (45%)
[parallel-audit-executor] Session Contract Explanations: executing (30%)
[parallel-audit-executor] Session User Flow Mapping: executing (60%)
[parallel-audit-executor] Session Test Execution: executing (20%)
```

### Check Session Outputs

```bash
# View individual session results
cat ~/.uatu/workspace/.../context/security_results.json
cat ~/.uatu/workspace/.../context/contract_explanations.json
cat ~/.uatu/workspace/.../context/user_flows.json
cat ~/.uatu/workspace/.../context/test_execution.json

# View combined results
cat ~/.uatu/workspace/.../context/results.json
```

## Performance Tuning

### For Small Projects (<10 contracts)
```bash
PARALLEL_SESSIONS=2
SESSION_TIMEOUT_MIN=10
```

### For Large Projects (>50 contracts)
```bash
PARALLEL_SESSIONS=4
SESSION_TIMEOUT_MIN=20
```

### For Resource-Constrained Environments
```bash
PARALLEL_SESSIONS=1  # Sequential execution
SESSION_TIMEOUT_MIN=15
```

## Next Steps After Integration

1. **Update Report Template** (pending):
   - Add HTML sections for new data
   - Add CSS for contract cards, flow tables, test results
   - Add JavaScript for filtering/interactivity

2. **Update UI** (pending):
   - Show parallel session progress
   - Add "Detailed Audit" checkbox
   - Display new report sections

3. **Add Tests**:
   - Unit tests for parallel executor
   - Integration tests for full audit flow
   - Backward compatibility tests

## Support

If issues arise:

1. Check logs: `~/.uatu/workspace/.../runs/<timestamp>/execute.log`
2. Check session prompts: `~/.uatu/workspace/.../runs/<timestamp>/*-prompt.txt`
3. Disable detailed audit: `ENABLE_DETAILED_AUDIT=false`
4. Report issue with logs

## Summary

- ✅ Choose Option A (simple) or Option B (clean separation)
- ✅ Test with disabled flag first
- ✅ Enable and test with small project
- ✅ Monitor session execution
- ✅ Verify new data in results.json
- ✅ Tune performance settings as needed

**Integration time: 5-15 minutes**
**Testing time: 30-60 minutes**
**Total activation time: <2 hours**
