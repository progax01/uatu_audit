import React from 'react'
import { AuditJob } from '../hooks/useJobList'

interface AuditCardProps {
  job: AuditJob
  onRerun?: (jobId: number) => void
  onCancel?: (jobId: number) => void
  onViewReport?: (job: AuditJob) => void
  onViewProgress?: (job: AuditJob) => void
}

export function AuditCard({ job, onRerun, onCancel, onViewReport, onViewProgress }: AuditCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    running: 'bg-[#00ffff]/20 text-[#00ffff] border border-[#00ffff]/30',
    done: 'bg-green-500/20 text-green-400 border border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getElapsedTime = () => {
    if (!job.startedAt) return null
    const start = new Date(job.startedAt).getTime()
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()
    const seconds = Math.floor((end - start) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-[#0d1426] hover:border-[#00ffff]/30 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg text-white">{job.project}</h3>
          <p className="text-sm text-gray-400">{job.branch}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
          {job.status}
        </span>
      </div>

      {job.status === 'running' && job.pct !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress</span>
            <span>{job.pct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-[#00ffff] h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 mb-3 space-y-1">
        <p>Created: {formatDate(job.createdAt)}</p>
        {job.startedAt && <p>Started: {formatDate(job.startedAt)}</p>}
        {getElapsedTime() && <p>Duration: {getElapsedTime()}</p>}
        {job.errorMessage && (
          <p className="text-red-400 truncate" title={job.errorMessage}>
            Error: {job.errorMessage}
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(job.status === 'running' || job.status === 'pending') && (
          <>
            {onViewProgress && (
              <button
                onClick={() => onViewProgress(job)}
                className="px-3 py-1 text-xs bg-[#00ffff]/10 text-[#00ffff] rounded hover:bg-[#00ffff]/20 border border-[#00ffff]/30"
              >
                View Progress
              </button>
            )}
            {onCancel && (
              <button
                onClick={() => onCancel(job.id)}
                className="px-3 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 border border-red-500/30"
              >
                Cancel
              </button>
            )}
          </>
        )}
        {job.status === 'done' && onViewReport && (
          <button
            onClick={() => onViewReport(job)}
            className="px-3 py-1 text-xs bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 border border-green-500/30"
          >
            View Report
          </button>
        )}
        {(job.status === 'done' || job.status === 'failed') && onRerun && (
          <button
            onClick={() => onRerun(job.id)}
            className="px-3 py-1 text-xs bg-gray-700/50 text-gray-300 rounded hover:bg-gray-700 border border-gray-600"
          >
            Re-run
          </button>
        )}
      </div>
    </div>
  )
}
