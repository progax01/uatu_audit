import { useState, useEffect } from 'react'
import { FileText, Calendar, Clock, ChevronRight, Loader2, Globe, Lock, Eye, EyeOff } from 'lucide-react'
import { authFetch } from '../../services/authService'
import { useNavigate } from 'react-router-dom'

interface AuditReport {
  id: string
  jobId: string
  createdAt: string
  completedAt?: string
  status: string
  sources: string[]
  score?: number
  findingsCount: number
  visibility?: 'private' | 'public' | 'unlisted'
  commitSha?: string
  branch?: string
  repoOwner?: string
  repoName?: string
}

interface AuditsTabProps {
  projectId: string
  runningJobId?: string | null
  onAuditComplete?: () => void
}

interface RunningAuditProgress {
  status: string
  pct: number
  currentStep?: string
  stepsCompleted?: number
  stepsTotal?: number
}

export default function AuditsTab({ projectId, runningJobId, onAuditComplete }: AuditsTabProps) {
  const navigate = useNavigate()
  const [audits, setAudits] = useState<AuditReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningProgress, setRunningProgress] = useState<RunningAuditProgress | null>(null)

  useEffect(() => {
    fetchAudits()
  }, [projectId])

  // SSE streaming for running audit
  useEffect(() => {
    if (!runningJobId) {
      setRunningProgress(null)
      return
    }

    let eventSource: EventSource | null = null
    let pollInterval: NodeJS.Timeout | null = null

    const startSSE = () => {
      const sseUrl = `/api/audit/${runningJobId}/progress/stream`
      eventSource = new EventSource(sseUrl)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.error) {
          console.error('SSE error:', data.error)
          return
        }

        setRunningProgress({
          status: data.status,
          pct: data.overallPct || 0,
          currentStep: data.currentStep?.name || data.currentStepName,
          stepsCompleted: data.stepsCompleted,
          stepsTotal: data.stepsTotal,
        })

        // Check if completed
        if (data.status === 'completed' || data.status === 'failed') {
          if (eventSource) {
            eventSource.close()
          }
          // Refresh audit list
          setTimeout(() => {
            fetchAudits()
            if (onAuditComplete) onAuditComplete()
          }, 1000)
        }
      }

      eventSource.onerror = () => {
        console.warn('SSE connection failed, falling back to polling')
        if (eventSource) {
          eventSource.close()
        }
        // Fallback to polling
        pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`/api/audit/${runningJobId}/progress`)
            if (response.ok) {
              const data = await response.json()
              setRunningProgress({
                status: data.status,
                pct: data.overallPct || 0,
                currentStep: data.currentStep?.name || data.currentStepName,
                stepsCompleted: data.stepsCompleted,
                stepsTotal: data.stepsTotal,
              })

              if (data.status === 'completed' || data.status === 'failed') {
                if (pollInterval) clearInterval(pollInterval)
                setTimeout(() => {
                  fetchAudits()
                  if (onAuditComplete) onAuditComplete()
                }, 1000)
              }
            }
          } catch (err) {
            console.error('Polling error:', err)
          }
        }, 2000)
      }
    }

    startSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [runningJobId])

  const fetchAudits = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/projects/${projectId}/audits`)
      if (res.ok) {
        const data = await res.json()
        console.log('Fetched audits:', data.audits?.length, data.audits)
        setAudits(data.audits || [])
      } else {
        setError('Failed to load audits')
      }
    } catch (err) {
      setError('Failed to load audits')
    } finally {
      setLoading(false)
    }
  }

  const toggleVisibility = async (auditId: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public'

    try {
      const res = await authFetch(`/api/audit/${auditId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      })

      if (res.ok) {
        // Update local state
        setAudits(audits.map(audit =>
          audit.jobId === auditId
            ? { ...audit, visibility: newVisibility as 'private' | 'public' | 'unlisted' }
            : audit
        ))
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to update visibility', { status: res.status, error: errorData, auditId })
      }
    } catch (err) {
      console.error('Error updating visibility:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; colorClass: string }> = {
      'pending': { label: 'PENDING', colorClass: 'bg-amber-50 text-amber-600 border-amber-100' },
      'running': { label: 'RUNNING', colorClass: 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' },
      'completed': { label: 'COMPLETED', colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      'failed': { label: 'FAILED', colorClass: 'bg-rose-50 text-rose-600 border-rose-100' }
    }
    return configs[status] || configs['pending']
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50'
    if (score >= 60) return 'text-blue-600 bg-blue-50'
    if (score >= 40) return 'text-amber-600 bg-amber-50'
    return 'text-rose-600 bg-rose-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Loading audits...</span>
        </div>
      </div>
    )
  }

  if (error) {
    // Just show empty state instead of error
    return (
      <div className="card-premium p-12 text-center">
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-slate-300" />
        </div>
        <h3 className="font-black text-slate-900 mb-2">No Audits Yet</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
          Start your first audit to see detailed security reports and findings.
        </p>
      </div>
    )
  }

  if (audits.length === 0) {
    return (
      <div className="card-premium p-12 text-center">
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-slate-300" />
        </div>
        <h3 className="font-black text-slate-900 mb-2">No Audits Yet</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
          Start your first audit to see detailed security reports and findings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Running Audit Progress */}
      {runningJobId && runningProgress && (
        <div className="card-premium p-6 border-indigo-200 bg-indigo-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border-blue-100 animate-pulse">
                RUNNING
              </span>
              <span className="text-sm font-bold text-slate-700">
                Audit in Progress
              </span>
            </div>
            <span className="text-sm font-bold text-indigo-600">
              {runningProgress.pct}%
            </span>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{runningProgress.currentStep || 'Initializing audit...'}</span>
              <span>
                {runningProgress.stepsCompleted || 0} / {runningProgress.stepsTotal || '?'} steps
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                style={{ width: `${runningProgress.pct || 0}%` }}
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            Job ID: {runningJobId}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest">
          Audit History ({audits.length})
        </h3>
      </div>

      <div className="space-y-3">
        {audits.map((audit) => {
          const statusConfig = getStatusConfig(audit.status)
          const isCompleted = audit.status === 'completed'
          const canNavigate = isCompleted

          return (
            <div
              key={audit.id}
              className="w-full card-premium p-5 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusConfig.colorClass}`}>
                      {statusConfig.label}
                    </span>
                    {audit.score !== undefined && audit.status === 'completed' && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${getScoreColor(audit.score)}`}>
                        {audit.score}/100
                      </span>
                    )}
                    {audit.status === 'completed' && (
                      <button
                        onClick={() => toggleVisibility(audit.jobId, audit.visibility || 'private')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-colors ${
                          audit.visibility === 'public'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={audit.visibility === 'public' ? 'Make Private' : 'Make Public'}
                      >
                        {audit.visibility === 'public' ? (
                          <>
                            <Globe size={10} />
                            PUBLIC
                          </>
                        ) : (
                          <>
                            <Lock size={10} />
                            PRIVATE
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      <span>{formatDate(audit.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>{formatTime(audit.createdAt)}</span>
                    </div>
                    {audit.findingsCount > 0 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                        {audit.findingsCount} {audit.findingsCount === 1 ? 'Finding' : 'Findings'}
                      </span>
                    )}
                  </div>

                  {audit.sources && audit.sources.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sources:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {audit.sources.map((source, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-1">
                    <div className="text-[10px] text-slate-300 font-mono">
                      ID: {audit.jobId}
                    </div>
                    {audit.commitSha && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-bold">Commit:</span>
                        {audit.repoOwner && audit.repoName ? (
                          <a
                            href={`https://github.com/${audit.repoOwner}/${audit.repoName}/commit/${audit.commitSha}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="View commit on GitHub"
                          >
                            {audit.commitSha.substring(0, 7)}
                          </a>
                        ) : (
                          <span className="font-mono px-2 py-0.5 bg-slate-50 rounded border border-slate-200">
                            {audit.commitSha.substring(0, 7)}
                          </span>
                        )}
                        {audit.branch && (
                          <span className="text-slate-300">
                            on{' '}
                            {audit.repoOwner && audit.repoName ? (
                              <a
                                href={`https://github.com/${audit.repoOwner}/${audit.repoName}/tree/${audit.branch}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                title="View branch on GitHub"
                              >
                                {audit.branch}
                              </a>
                            ) : (
                              <span className="font-mono font-bold">{audit.branch}</span>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {canNavigate && (
                  <button
                    onClick={() => navigate(`/audit/${audit.jobId}`)}
                    className="btn-primary px-4 py-2 text-xs flex-shrink-0 self-start"
                  >
                    View Report
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
