import { useState, useEffect, useRef, useCallback } from 'react'

interface AuditPhase {
  name: string
  pct: number
  note?: string
  step?: string
}

interface AuditProgress {
  overall_pct: number
  last_event?: string
  phases: AuditPhase[]
  timestamp?: string
}

interface JobLogEntry {
  timestamp: string
  level: string
  message: string
  data?: any
}

export function useAuditProgress(project: string, branch: string, shouldPoll: boolean, jobId?: number) {
  const [progress, setProgress] = useState<AuditProgress | null>(null)
  const [logs, setLogs] = useState<{ cli: string; execute: string; run: string }>({
    cli: '',
    execute: '',
    run: '',
  })
  const [jobLogs, setJobLogs] = useState<JobLogEntry[]>([])
  const logOffsetRef = useRef(0)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // SSE refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastTimestampRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkReportReady = useCallback(async () => {
    try {
      const res = await fetch(
        `/report?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&format=html`,
        { method: 'HEAD' }
      )
      return res.ok
    } catch {
      return false
    }
  }, [project, branch])

  // SSE connection with auto-reconnect
  const connectSSE = useCallback(() => {
    if (!project || !branch) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `/progress/stream?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onmessage = async (event) => {
      try {
        const data: AuditProgress = JSON.parse(event.data)

        // Detect new job by timestamp change
        if (data.timestamp && lastTimestampRef.current && data.timestamp !== lastTimestampRef.current) {
          // New job detected! Reset completion state
          console.log('[SSE] New job detected, resetting state')
          setIsComplete(false)
          setJobLogs([])
          logOffsetRef.current = 0
          setError(null)
        }
        lastTimestampRef.current = data.timestamp || null

        setProgress(data)
        setError(null)

        // Check if complete
        const allPhasesComplete = data.phases?.every((p) => p.pct === 100) || false
        const reportComplete = data.last_event?.includes('report-complete') || false
        const executePhaseComplete = data.phases?.find(p => p.name === 'execute')?.pct === 100

        if (data.overall_pct >= 100 || allPhasesComplete || reportComplete || executePhaseComplete) {
          if (!isComplete) {
            await checkReportReady()
            setIsComplete(true)
          }
        } else {
          // If progress drops below 100 AND no completion indicators, reset isComplete
          if (isComplete && data.overall_pct < 100 && !reportComplete && !executePhaseComplete) {
            setIsComplete(false)
          }
        }
      } catch (err) {
        console.error('[SSE] Parse error:', err)
      }
    }

    eventSource.onerror = () => {
      console.log('[SSE] Connection error, reconnecting in 3s...')
      eventSource.close()
      eventSourceRef.current = null

      // Auto-reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldPoll) {
          connectSSE()
        }
      }, 3000)
    }

    eventSource.onopen = () => {
      console.log('[SSE] Connected')
    }
  }, [project, branch, shouldPoll, isComplete, checkReportReady])

  // Fetch logs (still uses polling for simplicity)
  const fetchLogs = useCallback(async () => {
    try {
      if (jobId) {
        const res = await fetch(`/jobs/${jobId}/logs?offset=${logOffsetRef.current}&limit=50`)
        if (!res.ok) return
        const data = await res.json()
        if (data.logs && data.logs.length > 0) {
          setJobLogs(prev => [...prev, ...data.logs])
          logOffsetRef.current = data.nextOffset
        }
      } else {
        const res = await fetch(
          `/logs?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&tail=400`
        )
        if (!res.ok) return
        const data = await res.json()
        setLogs(data)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }, [project, branch, jobId])

  // Main effect for SSE connection
  useEffect(() => {
    if (!shouldPoll || !project || !branch) {
      return
    }

    // Connect to SSE
    connectSSE()

    // Start log polling
    fetchLogs()
    logIntervalRef.current = setInterval(fetchLogs, 2500)

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current)
        logIntervalRef.current = null
      }
    }
  }, [project, branch, shouldPoll, connectSSE, fetchLogs])

  const resetProgress = useCallback(() => {
    setProgress({
      overall_pct: 0,
      phases: [],
      last_event: 'Cancelled'
    })
    setIsComplete(false)
    setError(null)
    setLogs({ cli: '', execute: '', run: '' })
    setJobLogs([])
    logOffsetRef.current = 0
    lastTimestampRef.current = null

    // Close SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current)
      logIntervalRef.current = null
    }
  }, [])

  return { progress, logs, jobLogs, isComplete, error, resetProgress }
}
