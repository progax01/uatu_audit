import { useState } from 'react'
import { useAuditProgress } from '../hooks/useAuditProgress'

interface StepThreeProps {
  onBack: () => void
  repoData: any
}

export default function StepThree({ onBack, repoData }: StepThreeProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [jobId, setJobId] = useState<number | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)

  const { progress, logs, isComplete, error } = useAuditProgress(
    repoData.project,
    repoData.branch,
    hasStarted
  )

  const handleRunAudit = async () => {
    setIsRunning(true)

    try {
      const body = {
        repo: repoData.repo,
        project: repoData.project,
        branch: repoData.branch,
        ai: true,
        hintEcosystems: repoData.ecosystems || [],
        testStyles: repoData.testStyles || ['behavioral', 'stride'],
      }

      const res = await fetch('/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await res.json()
      console.log('Audit queued:', result)

      if (result.job?.id) {
        setJobId(result.job.id)
      }

      setHasStarted(true)
    } catch (error) {
      console.error('Failed to start audit:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleCancelAudit = async () => {
    if (!jobId) return

    console.log(`[Cancel Audit] Initiating cancel for job ${jobId}`, {
      project: repoData.project,
      branch: repoData.branch,
      timestamp: new Date().toISOString()
    })

    setIsCanceling(true)
    try {
      const res = await fetch(`/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await res.json()
      console.log(`[Cancel Audit] Response for job ${jobId}:`, {
        success: result.success,
        message: result.message,
        status: res.status
      })

      if (result.success) {
        console.log(`[Cancel Audit] Job ${jobId} cancelled successfully`)
        // Reset state
        setHasStarted(false)
        setJobId(null)
      } else {
        console.error(`[Cancel Audit] Failed to cancel job ${jobId}:`, result.message)
      }
    } catch (error) {
      console.error(`[Cancel Audit] Error cancelling job ${jobId}:`, error)
    } finally {
      setIsCanceling(false)
    }
  }

  const handleViewReport = (format: 'html' | 'pdf') => {
    const url = `/report?project=${encodeURIComponent(repoData.project)}&branch=${encodeURIComponent(repoData.branch)}&format=${format}`
    window.open(url, '_blank')
  }

  const overallProgress = progress?.overall_pct || 0
  const executionSteps = [
    { name: 'Bootstrap', key: 'bootstrap' },
    { name: 'Inventory', key: 'inventory' },
    { name: 'Analysis', key: 'analysis' },
    { name: 'Test Generation', key: 'testgen' },
    { name: 'Execution', key: 'execute' },
  ]

  return (
    <div className="card max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-uatu-text mb-6">Review & Run</h2>

      {/* Configuration Summary */}
      <div className="mb-6">
        <h3 className="text-uatu-text font-semibold mb-4">Audit Configuration</h3>

        <div className="space-y-4">
          <div className="p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
            <p className="text-uatu-muted text-sm mb-2">Repository</p>
            <p className="text-uatu-text font-mono text-sm break-all">{repoData.repo}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
              <p className="text-uatu-muted text-sm mb-2">Branch</p>
              <p className="text-uatu-text font-medium">{repoData.branch}</p>
            </div>
            <div className="p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
              <p className="text-uatu-muted text-sm mb-2">Project</p>
              <p className="text-uatu-text font-medium">{repoData.project}</p>
            </div>
          </div>

          {repoData.ecosystems && repoData.ecosystems.length > 0 && (
            <div className="p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
              <p className="text-uatu-muted text-sm mb-2">Ecosystems</p>
              <div className="flex flex-wrap gap-2">
                {repoData.ecosystems.map((eco: string) => (
                  <span
                    key={eco}
                    className="px-3 py-1 bg-uatu-accent bg-opacity-20 text-uatu-accent rounded-full text-sm font-medium"
                  >
                    {eco}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
            <p className="text-uatu-muted text-sm mb-2">Test Styles</p>
            <div className="flex flex-wrap gap-2">
              {(repoData.testStyles || []).map((style: string) => (
                <span
                  key={style}
                  className="px-3 py-1 bg-status-success bg-opacity-20 text-status-success rounded-full text-sm font-medium"
                >
                  {style}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {hasStarted && (
        <div className="mb-6">
          <h3 className="text-uatu-text font-semibold mb-4">Audit Progress</h3>

          {/* Overall Progress Bar */}
          <div className="mb-6 p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-uatu-text font-medium">Overall Progress</span>
              <span className="text-uatu-accent font-bold">{overallProgress.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-uatu-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-uatu-accent to-blue-400 transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            {progress?.last_event && (
              <p className="text-uatu-muted text-sm mt-2">{progress.last_event}</p>
            )}
          </div>

          {/* Execution Steps */}
          <div className="mb-6 p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
            <h4 className="text-uatu-text font-medium mb-4">Execution Steps</h4>
            <div className="space-y-3">
              {executionSteps.map((step) => {
                const phaseData = progress?.phases?.find((p) => p.name === step.key)
                const pct = phaseData?.pct || 0
                const isActive = pct > 0 && pct < 100
                const isDone = pct >= 100

                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isDone
                          ? 'bg-status-success text-white'
                          : isActive
                          ? 'bg-uatu-accent text-white animate-pulse'
                          : 'bg-uatu-line text-uatu-muted'
                      }`}
                    >
                      {isDone ? '✓' : pct > 0 ? '⋯' : '○'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${isDone || isActive ? 'text-uatu-text' : 'text-uatu-muted'}`}>
                          {step.name}
                        </span>
                        <span className="text-xs text-uatu-muted">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-uatu-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isDone ? 'bg-status-success' : 'bg-uatu-accent'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live Progress Details */}
          <div className="border border-uatu-border rounded-uatu-sm overflow-hidden">
            <div className="flex border-b border-uatu-border bg-uatu-input">
              <div className="px-6 py-3 font-medium bg-uatu-card text-uatu-accent border-b-2 border-uatu-accent">
                Live Progress Details
              </div>
            </div>

            <div className="p-4 bg-uatu-card">
              <div>
                <pre className="bg-uatu-code-bg text-uatu-code-text p-4 rounded-uatu-sm text-xs font-mono overflow-auto max-h-96">
                  {progress ? JSON.stringify(progress, null, 2) : 'Waiting for progress data...'}
                </pre>
              </div>
            </div>
          </div>

          {/* Report Buttons */}
          {isComplete && (
            <div className="mt-6 p-4 bg-status-success bg-opacity-10 border border-status-success rounded-uatu-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-status-success font-semibold mb-1">Audit Complete! ✅</p>
                  <p className="text-uatu-muted text-sm">
                    Your audit report is ready to view and download.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewReport('html')}
                    className="px-4 py-2 bg-status-success text-white rounded-uatu-sm font-medium hover:bg-opacity-90 transition-colors"
                  >
                    📄 View HTML Report
                  </button>
                  <button
                    onClick={() => handleViewReport('pdf')}
                    className="px-4 py-2 bg-uatu-accent text-white rounded-uatu-sm font-medium hover:bg-opacity-90 transition-colors"
                  >
                    📊 Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasStarted && (
        <div className="mb-6 p-12 bg-uatu-input rounded-uatu-sm border border-uatu-input-border text-center">
          <div className="mb-4">
            <svg className="w-20 h-20 mx-auto text-uatu-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-uatu-text font-semibold text-lg mb-2">Ready to Run Audit</h3>
          <p className="text-uatu-muted mb-6 max-w-md mx-auto">
            Click "Run Audit" below to start the automated security audit process. This will analyze your smart contracts and generate a comprehensive report.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-status-error bg-opacity-10 border border-status-error rounded-uatu-sm">
          <p className="text-status-error font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="btn-secondary"
          disabled={isRunning || (hasStarted && !isComplete && (progress?.overall_pct || 0) < 100)}
        >
          ← Back
        </button>
        <div className="flex gap-3">
          {hasStarted && !isComplete && (
            <button
              onClick={handleCancelAudit}
              disabled={isCanceling}
              className={`px-6 py-2 rounded-uatu-sm font-medium transition-colors border border-status-error text-status-error hover:bg-status-error hover:text-white ${isCanceling ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isCanceling ? 'Cancelling...' : 'Cancel Audit'}
            </button>
          )}
          {!hasStarted && (
            <button
              onClick={handleRunAudit}
              disabled={isRunning}
              className={`btn-primary ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRunning ? 'Starting Audit...' : 'Run Audit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
