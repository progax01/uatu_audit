import { useState, useEffect } from 'react'
import { FileText, Calendar, Clock, ChevronRight, Loader2 } from 'lucide-react'
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
}

interface AuditsTabProps {
  projectId: string
}

export default function AuditsTab({ projectId }: AuditsTabProps) {
  const navigate = useNavigate()
  const [audits, setAudits] = useState<AuditReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAudits()
  }, [projectId])

  const fetchAudits = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/projects/${projectId}/audits`)
      if (res.ok) {
        const data = await res.json()
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest">
          Audit History ({audits.length})
        </h3>
      </div>

      <div className="space-y-3">
        {audits.map((audit) => {
          const statusConfig = getStatusConfig(audit.status)

          return (
            <button
              key={audit.id}
              onClick={() => navigate(`/audit/${audit.jobId}`)}
              className="w-full card-premium p-5 hover:border-indigo-200 transition-all text-left group"
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

                  <div className="mt-3 text-[10px] text-slate-300 font-mono">
                    ID: {audit.jobId}
                  </div>
                </div>

                <ChevronRight
                  size={18}
                  className="text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0 mt-1"
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
