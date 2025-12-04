import { useState, useEffect, useCallback } from 'react'

export interface AuditJob {
  id: number
  repo: string
  project: string
  branch: string
  ai?: boolean
  testStyles?: string[]
  createdAt: string
  startedAt?: string
  finishedAt?: string
  status: 'pending' | 'running' | 'done' | 'failed'
  pct?: number
  runTimestamp?: string
  reportPath?: string
  errorMessage?: string
  note?: string
  sessionId?: string
}

interface UseJobListOptions {
  mine?: boolean
  status?: string[]
  limit?: number
  pollInterval?: number
}

export function useJobList(options: UseJobListOptions = {}) {
  const [jobs, setJobs] = useState<AuditJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (options.mine) params.set('mine', 'true')
      if (options.status?.length) params.set('status', options.status.join(','))
      if (options.limit) params.set('limit', String(options.limit))

      const res = await fetch(`/jobs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch jobs')

      const data = await res.json()
      setJobs(data.jobs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.mine, options.status?.join(','), options.limit])

  useEffect(() => {
    fetchJobs()

    if (options.pollInterval && options.pollInterval > 0) {
      const interval = setInterval(fetchJobs, options.pollInterval)
      return () => clearInterval(interval)
    }
  }, [fetchJobs, options.pollInterval])

  const rerunJob = async (jobId: number) => {
    const res = await fetch(`/jobs/${jobId}/rerun`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to re-run job')
    const data = await res.json()
    await fetchJobs()
    return data.job
  }

  const cancelJob = async (jobId: number) => {
    const res = await fetch(`/jobs/${jobId}/cancel`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to cancel job')
    await fetchJobs()
  }

  return { jobs, loading, error, refetch: fetchJobs, rerunJob, cancelJob }
}
