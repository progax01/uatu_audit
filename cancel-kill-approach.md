# Cancel with Process Kill - Implementation Approach

## Problem
Currently when user cancels:
- ✅ Job status changes to "failed"
- ✅ Cancellation flag is set
- ❌ But the running Claude CLI process continues
- ❌ Frontend still shows 79% progress

## Solution

### Frontend Changes

**File: `ui/src/pages/StepThree.tsx` (or ReviewAndRun.tsx)**

In `handleCancelAudit()` after successful cancel:
```typescript
if (result.success) {
  console.log('Audit cancelled successfully')
  // Reset progress to 0
  setProgress(null) // or create a reset progress state
  setHasStarted(false)
  setJobId(null)
}
```

**File: `ui/src/hooks/useAuditProgress.ts`**

Add a `resetProgress` function:
```typescript
const resetProgress = () => {
  setProgress({
    overall_pct: 0,
    phases: [],
    last_event: 'Cancelled'
  })
  setIsComplete(false)
  setError(null)
  // Stop polling
  if (intervalRef.current) clearInterval(intervalRef.current)
  if (logIntervalRef.current) clearInterval(logIntervalRef.current)
}

return { progress, logs, jobLogs, isComplete, error, resetProgress }
```

Then call it from StepThree when cancel succeeds.

---

### Backend Changes

**File: `src/services/ai/claudeCLIProvider.ts`**

Currently has:
- `activeSessions` Map to track PTY sessions
- Need to add: `sessionsByJobId` Map to lookup sessions by jobId

Changes needed:

1. **Track jobId with sessions**:
```typescript
const sessionsByJobId = new Map<number, string>(); // jobId -> sessionId

// In executeClaude(), add jobId tracking:
if (options.jobId) {
  sessionsByJobId.set(options.jobId, sessionId);
}
```

2. **Add killSessionByJobId() function**:
```typescript
export function killSessionByJobId(jobId: number): boolean {
  const sessionId = sessionsByJobId.get(jobId);
  if (!sessionId) return false;

  const ptySession = activeSessions.get(sessionId);
  if (!ptySession) return false;

  // Kill the PTY process
  ptySession.kill('SIGTERM');

  // Clean up
  activeSessions.delete(sessionId);
  sessionsByJobId.delete(jobId);

  return true;
}
```

3. **Export the function** so it can be called from cancelJob()

---

**File: `src/services/jobQueue.ts`**

In `cancelJob()` function, after marking job as failed:
```typescript
import { killSessionByJobId } from './ai/claudeCLIProvider.js';

export async function cancelJob(jobId: number) {
  cancelledJobs.add(jobId);

  return await withQueueLock(async () => {
    const q = await load();
    const j = q.jobs.find(x => x.id === jobId);

    // ... existing status checks ...

    j.status = 'failed';
    j.errorMessage = 'Cancelled by user';
    j.finishedAt = new Date().toISOString();
    await save(q);

    // NEW: Kill the running Claude CLI process
    const killed = killSessionByJobId(jobId);
    console.log(`Process kill attempt for job ${jobId}: ${killed ? 'success' : 'no active session'}`);

    setTimeout(() => cancelledJobs.delete(jobId), 60000);

    return { success: true, message: 'Job cancelled and process killed' };
  });
}
```

---

## How It Works

### When User Clicks Cancel:

1. **Frontend** sends POST to `/jobs/{id}/cancel`
2. **Backend `cancelJob()`**:
   - Marks job as "failed" in jobs.json
   - Adds jobId to `cancelledJobs` Set
   - **Calls `killSessionByJobId()`** to kill Claude CLI process
3. **Claude CLI Provider**:
   - Looks up sessionId by jobId
   - Finds PTY session
   - Calls `ptySession.kill('SIGTERM')`
   - Process stops immediately
4. **Frontend receives success**:
   - Calls `resetProgress()` to set progress to 0%
   - Stops polling
   - Resets state

### Result:
- ✅ Job status = "failed"
- ✅ Claude CLI process killed
- ✅ Progress reset to 0% in UI
- ✅ User can start new audit

---

## Implementation Order

1. Add `killSessionByJobId()` to claudeCLIProvider.ts
2. Call it from `cancelJob()` in jobQueue.ts
3. Add `resetProgress()` to useAuditProgress hook
4. Call `resetProgress()` from StepThree/ReviewAndRun cancel handler
5. Rebuild and test

---

## Notes

- SIGTERM is graceful termination (allows cleanup)
- If process doesn't die in 5s, could follow up with SIGKILL
- The cooperative cancellation checks remain as backup
- Frontend reset is immediate (doesn't wait for backend confirmation)
