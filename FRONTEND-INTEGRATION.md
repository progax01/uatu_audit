# Frontend Integration Guide

## Deep Intelligence Framework UI Components

This guide explains how to integrate the new Milestone Tracker and Chain-of-Thought Reasoning components into the UatuAudit frontend.

## Components Overview

### 1. MilestoneTracker Component

**Location**: `ui/src/components/MilestoneTracker.tsx`

**Purpose**: Visualizes the 5-milestone audit pipeline with real-time progress tracking.

**Props**:
```typescript
interface MilestoneTrackerProps {
  milestones: Milestone[]
  currentMilestone?: number
}

interface Milestone {
  number: number              // 1-5
  name: string               // e.g., "Context Ingestion"
  description: string        // Brief description
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number           // 0-100
  duration?: number          // Seconds taken
  step?: string              // Current step being executed
}
```

**Example Usage**:
```tsx
import MilestoneTracker from '../components/MilestoneTracker'

// In your component:
const milestones = [
  {
    number: 1,
    name: 'Context Ingestion',
    description: 'Loading project structure',
    status: 'completed',
    progress: 100,
    duration: 45
  },
  {
    number: 2,
    name: 'Static Analysis',
    description: 'Analyzing code patterns',
    status: 'running',
    progress: 65,
    step: 'Analyzing smart contracts...'
  },
  // ... remaining milestones
]

<MilestoneTracker milestones={milestones} currentMilestone={2} />
```

### 2. CoTReasoning Component

**Location**: `ui/src/components/CoTReasoning.tsx`

**Purpose**: Displays AI's chain-of-thought reasoning steps with confidence scoring.

**Props**:
```typescript
interface CoTReasoningProps {
  reasoning: CoTStep[]
  metadata?: {
    total_steps: number
    avg_confidence: number
    reasoning_quality: 'high' | 'medium' | 'low'
  }
}

interface CoTStep {
  step: string                    // Step name/title
  observation: string             // What was observed
  hypothesis: string              // What might be wrong
  validation: string | string[]   // How it was validated
  conclusion: string              // Final conclusion
  confidence?: number             // 0.0 - 1.0
  confidence_factors?: string[]   // Factors affecting confidence
  related_finding?: string        // Finding ID
}
```

**Example Usage**:
```tsx
import CoTReasoning from '../components/CoTReasoning'

// In your component:
const reasoning = [
  {
    step: 'Reentrancy Detection',
    observation: 'Found external call before state update in withdraw()',
    hypothesis: 'This pattern may allow reentrancy attacks',
    validation: [
      'Confirmed external call at line 42',
      'State update occurs at line 45',
      'No reentrancy guard present'
    ],
    conclusion: 'Critical reentrancy vulnerability confirmed',
    confidence: 0.95,
    confidence_factors: ['Pattern match', 'No guards', 'State after call'],
    related_finding: 'WEB3-001'
  },
  // ... more steps
]

const metadata = {
  total_steps: 12,
  avg_confidence: 0.87,
  reasoning_quality: 'high'
}

<CoTReasoning reasoning={reasoning} metadata={metadata} />
```

## Backend Integration

### Current Progress API

The existing `/progress/stream` endpoint returns:
```typescript
interface AuditProgress {
  overall_pct: number
  last_event?: string
  phases: AuditPhase[]
  timestamp?: string
}

interface AuditPhase {
  name: string
  pct: number
  note?: string
  step?: string
}
```

### Required Backend Updates

To fully integrate these components, the backend needs to expose milestone data. Here are the recommended changes:

#### 1. Update Progress Endpoint

**File**: `src/services/process.ts` (or wherever progress is tracked)

Add milestone tracking to progress data:

```typescript
interface EnhancedAuditProgress extends AuditProgress {
  milestones?: {
    current?: number  // 1-5
    completed: number[]
    data: MilestoneData[]
  }
  reasoning?: CoTStep[]
  reasoning_metadata?: {
    total_steps: number
    avg_confidence: number
    reasoning_quality: 'high' | 'medium' | 'low'
  }
}

interface MilestoneData {
  number: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  duration?: number
  started_at?: string
  completed_at?: string
  step?: string
}
```

#### 2. Track Milestone Progress

In `src/sops/milestoneExecutor.ts`, update progress tracking:

```typescript
// Add to MilestoneExecutor class
private async updateMilestoneProgress(
  milestone: number,
  progress: number,
  step?: string
): Promise<void> {
  const milestoneData = {
    number: milestone,
    name: this.getMilestoneName(milestone),
    status: progress === 100 ? 'completed' : 'running',
    progress,
    step
  }

  // Emit to progress tracking system
  await this.progressEmitter.emit('milestone:progress', milestoneData)
}
```

#### 3. Expose CoT Reasoning

In the audit result, include reasoning:

```typescript
// After analysis completes
const result = {
  findings: [...],
  reasoning: cotParser.parseOutput(aiOutput).reasoning,
  reasoning_metadata: cotParser.parseOutput(aiOutput).metadata
}
```

### Migration Strategy

**Phase 1: Display with Mock Data** (Immediate)
- Use the components with mock/placeholder data
- Test UI/UX without backend changes

**Phase 2: Basic Integration** (Short-term)
- Map existing `phases` array to `milestones` prop
- Display reasoning if available in audit results

**Phase 3: Full Integration** (Long-term)
- Implement milestone tracking in backend
- Add CoT reasoning to progress stream
- Real-time updates for both components

## Example: Integrating into ReviewAndRun

**File**: `ui/src/pages/ReviewAndRun.tsx`

```tsx
import { useState, useEffect } from 'react'
import { useAuditProgress } from '../hooks/useAuditProgress'
import MilestoneTracker from '../components/MilestoneTracker'
import CoTReasoning from '../components/CoTReasoning'

export default function ReviewAndRun({ ... }) {
  const { progress, ... } = useAuditProgress(...)
  const [reasoning, setReasoning] = useState([])

  // Map phases to milestones (temporary until backend provides milestone data)
  const milestones = useMemo(() => {
    if (!progress?.phases) return []

    // Map phase names to milestone numbers
    const phaseToMilestone = {
      'context': 1,
      'static': 2,
      'logic': 3,
      'test': 4,
      'consolidate': 5
    }

    return progress.phases
      .map(phase => {
        const milestoneNum = phaseToMilestone[phase.name.toLowerCase()]
        if (!milestoneNum) return null

        return {
          number: milestoneNum,
          name: getMilestoneName(milestoneNum),
          description: getMilestoneDescription(milestoneNum),
          status: phase.pct === 100 ? 'completed' :
                  phase.pct > 0 ? 'running' : 'pending',
          progress: phase.pct,
          step: phase.step
        }
      })
      .filter(Boolean)
  }, [progress])

  // Fetch reasoning when audit completes
  useEffect(() => {
    if (isComplete) {
      fetchReasoning()
    }
  }, [isComplete])

  const fetchReasoning = async () => {
    try {
      const res = await fetch(`/audit/${jobId}/reasoning`)
      const data = await res.json()
      setReasoning(data.reasoning || [])
    } catch (err) {
      console.error('Failed to fetch reasoning:', err)
    }
  }

  return (
    <div>
      {/* ... existing code ... */}

      {/* Add Milestone Tracker */}
      <div className="mb-6">
        <MilestoneTracker
          milestones={milestones}
          currentMilestone={getCurrentMilestone(progress)}
        />
      </div>

      {/* Add CoT Reasoning (show when available) */}
      {reasoning.length > 0 && (
        <div className="mb-6">
          <CoTReasoning
            reasoning={reasoning}
            metadata={reasoningMetadata}
          />
        </div>
      )}

      {/* ... rest of existing code ... */}
    </div>
  )
}
```

## Styling Notes

Both components use **Tailwind CSS** for styling and are designed to match the existing UatuAudit design system:
- Colors: `#0F3F62` (primary blue), purple accents for AI features
- Borders: `border-gray-200`
- Shadows: `shadow-sm` for subtle depth
- Rounded corners: `rounded-xl` for cards
- Animations: Pulse effects for active states

## Testing

### Test MilestoneTracker
```tsx
// Test pending state
<MilestoneTracker milestones={[]} />

// Test running state
<MilestoneTracker
  milestones={[
    { number: 1, status: 'completed', progress: 100, ... },
    { number: 2, status: 'running', progress: 45, step: 'Analyzing...' }
  ]}
  currentMilestone={2}
/>

// Test completed state
<MilestoneTracker
  milestones={allMilestonesCompleted}
/>
```

### Test CoTReasoning
```tsx
// Test empty state
<CoTReasoning reasoning={[]} />

// Test with data
<CoTReasoning
  reasoning={mockReasoningSteps}
  metadata={{
    total_steps: 5,
    avg_confidence: 0.88,
    reasoning_quality: 'high'
  }}
/>
```

## Future Enhancements

1. **Real-time Reasoning Updates**: Stream reasoning steps as they're generated
2. **Interactive Findings**: Click on reasoning steps to navigate to related findings
3. **Reasoning Replay**: Replay the AI's thought process step-by-step
4. **Confidence Threshold Filtering**: Filter reasoning by confidence level
5. **Reasoning Export**: Export reasoning as PDF/JSON for documentation

## Support

For questions or issues:
- Check existing progress tracking in `src/services/process.ts`
- Review milestone executor in `src/sops/milestoneExecutor.ts`
- Refer to CoT parser in `src/services/cotParser.ts`

---

**Deep Intelligence Framework** - Making AI reasoning transparent and auditable.
