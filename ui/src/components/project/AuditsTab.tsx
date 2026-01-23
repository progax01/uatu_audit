import { useState, useEffect } from 'react'
import { FileText, Calendar, Clock, ChevronRight, Loader2, Globe, Lock, Eye, EyeOff, RotateCcw, X } from 'lucide-react'
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
  auditDepth?: 'quick' | 'standard' | 'deep'
  auditType?: 'quick' | 'full'
  errorMessage?: string
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

  // SSE streaming for running audit - auto-detects from audit list OR uses prop
  useEffect(() => {
    // Determine which job to track:
    // 1. Use runningJobId prop if provided (newly started audit)
    // 2. Otherwise, auto-detect from audits list (page reload case)
    let activeJobId = runningJobId

    if (!activeJobId) {
      // Check for any active audit status
      const activeStatuses = ['pending', 'queued', 'running', 'cloning', 'analyzing', 'awaiting_clarification', 'auditing', 'generating']
      const runningAudit = audits.find(audit =>
        activeStatuses.includes(audit.status)
      )
      activeJobId = runningAudit?.jobId || null
    }

    if (!activeJobId) {
      setRunningProgress(null)
      return
    }

    let eventSource: EventSource | null = null
    let pollInterval: NodeJS.Timeout | null = null

    const startSSE = () => {
      const sseUrl = `/api/audit/${activeJobId}/progress/stream`
      eventSource = new EventSource(sseUrl)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.error) {
          console.error('SSE error:', data.error)
          return
        }

        // Check if questionnaire is ready
        if (data.questionnaireReady && data.questionnaireUrl) {
          console.log('📋 Questionnaire ready! Redirecting to:', data.questionnaireUrl)
          // Close SSE before navigating
          if (eventSource) {
            eventSource.close()
          }
          // Navigate to questionnaire
          setTimeout(() => {
            window.location.href = data.questionnaireUrl
          }, 100)
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
            const response = await fetch(`/api/audit/${activeJobId}/progress`)
            if (response.ok) {
              const data = await response.json()

              // Check if questionnaire is ready (polling fallback)
              if (data.questionnaireReady && data.questionnaireUrl) {
                console.log('📋 Questionnaire ready (polling)! Redirecting to:', data.questionnaireUrl)
                if (pollInterval) clearInterval(pollInterval)
                setTimeout(() => {
                  window.location.href = data.questionnaireUrl
                }, 100)
                return
              }

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
  }, [runningJobId, audits, projectId])

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

  const retryAudit = async (auditId: string) => {
    if (!confirm('Retry this failed audit? It will be added back to the queue.')) {
      return
    }

    try {
      const res = await authFetch(`/api/audit/${auditId}/retry`, {
        method: 'POST'
      })

      if (res.ok) {
        const data = await res.json()
        console.log('Audit retry queued:', data)

        // Refresh audit list
        fetchAudits()

        alert('Audit has been queued for retry')
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || 'Failed to retry audit')
        console.error('Failed to retry audit', { status: res.status, error: errorData, auditId })
      }
    } catch (err) {
      console.error('Error retrying audit:', err)
      alert('Error retrying audit')
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
      'queued': { label: 'QUEUED', colorClass: 'bg-blue-50 text-blue-600 border-blue-100' },
      'running': { label: 'RUNNING', colorClass: 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' },
      'cloning': { label: 'CLONING', colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-100 animate-pulse' },
      'analyzing': { label: 'ANALYZING', colorClass: 'bg-violet-50 text-violet-600 border-violet-100 animate-pulse' },
      'awaiting_clarification': { label: 'AWAITING INPUT', colorClass: 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' },
      'auditing': { label: 'AUDITING', colorClass: 'bg-purple-50 text-purple-600 border-purple-100 animate-pulse' },
      'generating': { label: 'GENERATING REPORT', colorClass: 'bg-cyan-50 text-cyan-600 border-cyan-100 animate-pulse' },
      'completed': { label: 'COMPLETED', colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      'failed': { label: 'FAILED', colorClass: 'bg-rose-50 text-rose-600 border-rose-100' },
      'cancelled': { label: 'CANCELLED', colorClass: 'bg-slate-50 text-slate-500 border-slate-200' }
    }
    return configs[status] || { label: status.toUpperCase(), colorClass: 'bg-slate-50 text-slate-500 border-slate-200' }
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
      {runningProgress && (
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

          <div className="flex items-center justify-between">
            {runningJobId && (
              <div className="text-[10px] text-slate-400 font-mono">
                Job ID: {runningJobId}
              </div>
            )}
            {runningJobId && (
              <button
                onClick={() => navigate(`/audit/${runningJobId}`)}
                className="btn-primary px-4 py-2 text-xs ml-auto"
              >
                Show Progress
                <ChevronRight size={14} />
              </button>
            )}
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
          const isFailed = audit.status === 'failed'
          const activeStatuses = ['pending', 'queued', 'running', 'cloning', 'analyzing', 'awaiting_clarification', 'auditing', 'generating']
          const isRunning = activeStatuses.includes(audit.status)
          const canViewReport = isCompleted
          const canViewStatus = isRunning

          return (
            <div
              key={audit.id}
              className="w-full card-premium p-6 text-left hover:border-indigo-200 transition-all"
            >
              {/* Main content row */}
              <div className="flex items-start justify-between gap-6">
                {/* Left: Project info card */}
                <div className="flex-1 min-w-0">
                  {/* Project name */}
                  {audit.sources && audit.sources.length > 0 && (
                    <h3 className="text-lg font-black text-slate-900 mb-2 truncate">
                      {audit.sources[0]}
                    </h3>
                  )}

                  {/* Commit + Branch */}
                  {audit.commitSha && (
                    <div className="flex items-center gap-2 mb-2">
                      {audit.repoOwner && audit.repoName ? (
                        <a
                          href={`https://github.com/${audit.repoOwner}/${audit.repoName}/commit/${audit.commitSha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors font-bold"
                          title="View commit on GitHub"
                        >
                          {audit.commitSha.substring(0, 7)}
                        </a>
                      ) : (
                        <span className="font-mono text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 font-bold">
                          {audit.commitSha.substring(0, 7)}
                        </span>
                      )}
                      {audit.branch && (
                        <>
                          <span className="text-slate-300 text-xs">on</span>
                          {audit.repoOwner && audit.repoName ? (
                            <a
                              href={`https://github.com/${audit.repoOwner}/${audit.repoName}/tree/${audit.branch}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                              title="View branch on GitHub"
                            >
                              {audit.branch}
                            </a>
                          ) : (
                            <span className="font-mono text-xs font-bold text-slate-700">{audit.branch}</span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Date + Time */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      <span>{formatDate(audit.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>{formatTime(audit.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Status badges + actions */}
                <div className="flex flex-col items-end gap-3">
                  {/* Top badges row */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${statusConfig.colorClass}`}>
                      {statusConfig.label}
                    </span>
                    {audit.auditDepth && (
                      <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                        audit.auditDepth === 'deep' ? 'bg-violet-50 text-violet-600 border-violet-200' :
                        audit.auditDepth === 'standard' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {audit.auditDepth === 'deep' ? 'DEEP' :
                         audit.auditDepth === 'standard' ? 'STANDARD' :
                         'QUICK'}
                      </span>
                    )}
                  </div>

                  {/* Middle metrics row */}
                  <div className="flex items-center gap-2">
                    {audit.score !== undefined && audit.status === 'completed' && (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-black ${getScoreColor(audit.score)}`}>
                        {audit.score}/100
                      </span>
                    )}
                    {audit.findingsCount > 0 && (
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                        {audit.findingsCount} {audit.findingsCount === 1 ? 'Finding' : 'Findings'}
                      </span>
                    )}
                    {audit.status === 'completed' && (
                      <button
                        onClick={() => toggleVisibility(audit.jobId, audit.visibility || 'private')}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-colors ${
                          audit.visibility === 'public'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={audit.visibility === 'public' ? 'Make Private' : 'Make Public'}
                      >
                        {audit.visibility === 'public' ? (
                          <>
                            <Globe size={11} />
                            PUBLIC
                          </>
                        ) : (
                          <>
                            <Lock size={11} />
                            PRIVATE
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action button */}
                  {canViewReport && (
                    <button
                      onClick={() => navigate(`/audit/${audit.jobId}`)}
                      className="btn-primary px-5 py-2.5 text-xs"
                    >
                      View Report
                      <ChevronRight size={14} />
                    </button>
                  )}
                  {canViewStatus && (
                    <button
                      onClick={() => navigate(`/audit/${audit.jobId}`)}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all"
                      title="View audit status"
                    >
                      <Eye size={14} />
                      View Status
                    </button>
                  )}
                  {isFailed && (
                    <button
                      onClick={() => retryAudit(audit.jobId)}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-amber-50 text-amber-700 border-2 border-amber-200 rounded-xl hover:bg-amber-100 hover:border-amber-300 transition-all"
                      title="Retry this audit"
                    >
                      <RotateCcw size={14} />
                      Retry Audit
                    </button>
                  )}
                </div>
              </div>

              {/* Error message - full width below */}
              {audit.status === 'failed' && audit.errorMessage && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="text-rose-500 mt-0.5 flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-rose-700 uppercase tracking-wide mb-1">Error</p>
                      <p className="text-sm text-rose-600 leading-relaxed">{audit.errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Job ID - clickable link to audit status */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Job ID:</span>
                  <button
                    onClick={() => navigate(`/audit/${audit.jobId}`)}
                    className="text-[10px] text-indigo-600 font-mono hover:text-indigo-700 hover:underline font-semibold transition-colors"
                    title="Click to view audit details"
                  >
                    {audit.jobId.substring(0, 16)}...
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(audit.jobId)
                      // You could add a toast notification here
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-mono transition-colors"
                    title="Copy full Job ID"
                  >
                    [copy]
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
