import { useState, useEffect, useRef } from 'react'
import { useAuditProgress } from '../hooks/useAuditProgress'
import { Check, ChevronLeft, Play, FileText, Download, Loader2, XCircle, Search, RefreshCw } from 'lucide-react'
import logo from '../assets/logo.svg'

interface ReviewAndRunProps {
  onBack: () => void
  onHomeClick: () => void
  repoData: any
  initialJobId?: number
}

export default function ReviewAndRun({ onBack, onHomeClick, repoData, initialJobId }: ReviewAndRunProps) {
  const [isRunning, setIsRunning] = useState(!!initialJobId)
  const [hasStarted, setHasStarted] = useState(!!initialJobId)
  const [activeTab, setActiveTab] = useState<'progress' | 'certificate'>('progress')
  const [jobId, setJobId] = useState<number | undefined>(initialJobId)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState<string>('')
  const [estimatedRemaining, setEstimatedRemaining] = useState<string>('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState('')
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const consoleRef = useRef<HTMLDivElement>(null)
  const smoothedRemainingRef = useRef<number | null>(null)
  const lastProgressRef = useRef<number>(0)
  const lastDiffRef = useRef<number>(0)

  const { progress, logs, jobLogs, isComplete, error, resetProgress } = useAuditProgress(
    repoData.project,
    repoData.branch,
    hasStarted,
    jobId
  )

  // Auto-switch to certificate tab when audit completes
  useEffect(() => {
    if (isComplete && !error) {
      setActiveTab('certificate')
    }
  }, [isComplete, error])

  // Update elapsed time and ETA every second
  useEffect(() => {
    if (!startTime || isComplete) return

    const updateElapsed = () => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      const mins = Math.floor(diff / 60)
      const secs = diff % 60
      setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`)

      // Calculate estimated remaining time with EMA smoothing
      const currentProgress = progress?.overall_pct || 0
      if (currentProgress > 5 && currentProgress < 100) {
        // Calculate current rate (progress per second)
        const progressDelta = currentProgress - lastProgressRef.current
        const timeDelta = diff - lastDiffRef.current

        // Only update rate when progress changes
        if (progressDelta > 0 && timeDelta > 0) {
          const currentRate = progressDelta / timeDelta // progress% per second
          const remainingProgress = 100 - currentProgress
          const rawRemaining = remainingProgress / currentRate

          // Apply EMA smoothing (alpha = 0.3 gives more weight to recent values)
          const alpha = 0.3
          if (smoothedRemainingRef.current === null) {
            smoothedRemainingRef.current = rawRemaining
          } else {
            smoothedRemainingRef.current = alpha * rawRemaining + (1 - alpha) * smoothedRemainingRef.current
          }

          lastProgressRef.current = currentProgress
          lastDiffRef.current = diff
        }

        // Use smoothed remaining or fallback to linear estimate
        const remaining = smoothedRemainingRef.current !== null
          ? Math.max(0, smoothedRemainingRef.current)
          : Math.max(0, (diff / currentProgress) * (100 - currentProgress))

        const remMins = Math.floor(remaining / 60)
        const remSecs = Math.floor(remaining % 60)
        setEstimatedRemaining(`~${remMins}:${remSecs.toString().padStart(2, '0')} remaining`)
      } else if (currentProgress <= 5) {
        setEstimatedRemaining('Calculating...')
      } else {
        setEstimatedRemaining('')
      }
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [startTime, isComplete, progress?.overall_pct])

  const handleRunAudit = async () => {
    setIsRunning(true)

    // Reset progress state BEFORE starting new audit to clear any cached data
    resetProgress()
    setIsCancelled(false)
    // Reset EMA refs for fresh estimation
    smoothedRemainingRef.current = null
    lastProgressRef.current = 0
    lastDiffRef.current = 0

    try {
      const body = {
        repo: repoData.repo,
        project: repoData.project,
        branch: repoData.branch,
        ai: true,
        hintEcosystems: repoData.ecosystems || [],
        testStyles: repoData.testStyles || ['behavioral', 'stride'],
        selectedFiles: repoData.selectedFiles || [],
      }

      const res = await fetch('/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include', // Ensure cookies are sent
      })

      const result = await res.json()
      console.log('Audit queued:', result)

      // Check for authentication error
      if (!res.ok || result.ok === false) {
        if (res.status === 401 || result.error === 'Authentication required') {
          setAuthError(result.hint || 'Please login with GitHub OAuth before starting an audit')
          console.error('Authentication required:', result)
          return
        }
        // Other errors
        setAuthError(result.error || 'Failed to start audit')
        console.error('Enqueue failed:', result)
        return
      }

      // Clear any previous auth error
      setAuthError(null)

      // Store job ID for job-specific log fetching
      if (result.job?.id) {
        setJobId(result.job.id)
      }

      setStartTime(new Date())
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to start audit:', error)
      setAuthError('Network error: Failed to connect to server')
    } finally {
      setIsRunning(false)
    }
  }

  const handleViewReport = (format: 'html' | 'pdf') => {
    const url = `/report?project=${encodeURIComponent(repoData.project)}&branch=${encodeURIComponent(repoData.branch)}&format=${format}`
    if (format === 'pdf') {
      // Download PDF directly
      const link = document.createElement('a')
      link.href = url
      link.download = `${repoData.project}-${repoData.branch}-audit.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleCancelAudit = async () => {
    if (!jobId || isCancelling) return

    console.log(`[Cancel Audit] Initiating cancel for job ${jobId}`, {
      project: repoData.project,
      branch: repoData.branch,
      timestamp: new Date().toISOString()
    })

    setIsCancelling(true)
    try {
      const res = await fetch(`/jobs/${jobId}/cancel`, {
        method: 'POST',
      })
      const result = await res.json()
      console.log(`[Cancel Audit] Response for job ${jobId}:`, {
        success: result.success,
        message: result.message,
        status: res.status
      })

      if (result.success) {
        console.log(`[Cancel Audit] Job ${jobId} cancelled successfully`)
        resetProgress() // Reset progress to 0% and stop polling
        setHasStarted(false)
        setJobId(undefined)
        setStartTime(null) // Stop the timer
        setElapsedTime('')
        setEstimatedRemaining('')
        setIsCancelled(true)
        // Reset EMA refs
        smoothedRemainingRef.current = null
        lastProgressRef.current = 0
        lastDiffRef.current = 0
      } else {
        console.error(`[Cancel Audit] Failed to cancel job ${jobId}:`, result.message)
      }
    } catch (error) {
      console.error(`[Cancel Audit] Error cancelling job ${jobId}:`, error)
    } finally {
      setIsCancelling(false)
    }
  }

  // Auto-scroll console to bottom when new logs arrive (console tab removed, keep for future use)
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [jobLogs, logs])

  // Filter and format job logs with color-coding
  const getFilteredLogs = () => {
    if (!jobLogs || jobLogs.length === 0) return []

    return jobLogs.filter((entry) => {
      // Filter by log level
      if (logLevel !== 'all' && entry.level !== logLevel) return false

      // Filter by search text
      if (logFilter) {
        const searchLower = logFilter.toLowerCase()
        const matchMessage = entry.message.toLowerCase().includes(searchLower)
        const matchData = entry.data ? JSON.stringify(entry.data).toLowerCase().includes(searchLower) : false
        if (!matchMessage && !matchData) return false
      }

      return true
    })
  }

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-600'
      case 'warn': return 'text-yellow-600'
      case 'debug': return 'text-gray-500'
      default: return 'text-green-600'
    }
  }

  const getLevelBgColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-50'
      case 'warn': return 'bg-yellow-50'
      default: return ''
    }
  }

  const handleRetry = () => {
    setHasStarted(false)
    setIsCancelled(false)
    setJobId(undefined)
    setStartTime(null)
    setElapsedTime('')
    setEstimatedRemaining('')
    setLogFilter('')
    setLogLevel('all')
    // Reset EMA refs
    smoothedRemainingRef.current = null
    lastProgressRef.current = 0
    lastDiffRef.current = 0
  }

  const formatJobLogs = (logs: Array<{ timestamp: string; level: string; message: string; data?: any }>) => {
    if (!logs || logs.length === 0) return 'Waiting for job logs...'

    return logs
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString()
        const level = entry.level.toUpperCase()
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
        return `[${time}] ${level}: ${entry.message}${data}`
      })
      .join('\n')
  }

  const formatCliLogs = (cliLogs: string) => {
    if (!cliLogs) return 'No logs available yet...'

    const lines = cliLogs.split('\n')
    return lines
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed)
            const timestamp = parsed.timestamp
              ? new Date(parsed.timestamp).toLocaleTimeString()
              : ''
            const level = parsed.level || 'info'
            const message = parsed.message || parsed.data?.summary || ''
            const module = parsed.module || ''
            return `[${timestamp}] ${level.toUpperCase()}: ${message} ${module ? `(${module})` : ''}`
          } catch {
            return line
          }
        }
        return line
      })
      .join('\n')
  }

  const overallProgress = progress?.overall_pct || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(15, 63, 98, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15, 63, 98, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onHomeClick}
            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0"
          >
            <img src={logo} alt="Uatu Logo" className="h-10" />
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Step Progress Indicator */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-8 sm:mb-16">
          {/* Step 1 - Completed */}
          <div className="flex-1">
            <div className="border border-green-200 bg-green-50 backdrop-blur-sm rounded-lg px-4 sm:px-6 py-3 sm:py-4">
              <div className="text-green-600 font-semibold text-sm sm:text-lg flex items-center gap-2">
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Step 1: </span>Connect Source
              </div>
            </div>
          </div>

          {/* Step 2 - Completed */}
          <div className="flex-1">
            <div className="border border-green-200 bg-green-50 backdrop-blur-sm rounded-lg px-4 sm:px-6 py-3 sm:py-4">
              <div className="text-green-600 font-semibold text-sm sm:text-lg flex items-center gap-2">
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Step 2: </span>Configure
              </div>
            </div>
          </div>

          {/* Step 3 - Active */}
          <div className="flex-1">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/10 to-[#0F3F62]/5 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative border-2 border-[#0F3F62] bg-white backdrop-blur-sm rounded-lg px-4 sm:px-6 py-3 sm:py-4 shadow-lg shadow-[#0F3F62]/10">
                <div className="text-[#0F3F62] font-semibold text-sm sm:text-lg"><span className="hidden sm:inline">Step 3: </span>Review & Run</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/5 via-[#0F3F62]/3 to-[#0F3F62]/5 rounded-2xl blur-xl" />

          <div className="relative border border-gray-200 bg-white backdrop-blur-xl rounded-2xl p-6 sm:p-12 shadow-xl">
            {/* Main Heading */}
            <h1 className="text-2xl sm:text-5xl font-bold text-[#0F3F62] mb-6 sm:mb-12 tracking-tight">
              Review & Run Audit
            </h1>

            {/* Configuration Summary */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-[#0F3F62] mb-6">Audit Configuration</h2>

              <div className="space-y-4">
                {/* Project Details */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-[#0F3F62] font-semibold text-lg mb-4">Project Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Project:</span>
                      <span className="text-gray-800 ml-2 font-medium">{repoData.project}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Branch:</span>
                      <span className="text-gray-800 ml-2 font-medium">{repoData.branch}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Repository:</span>
                      <span className="text-gray-800 ml-2 font-medium break-all">{repoData.repo}</span>
                    </div>
                  </div>
                </div>

                {/* Ecosystems */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-[#0F3F62] font-semibold text-lg mb-4">Ecosystems</h3>
                  <div className="flex flex-wrap gap-2">
                    {repoData.ecosystems && repoData.ecosystems.length > 0 ? (
                      repoData.ecosystems.map((eco: string) => (
                        <span key={eco} className="px-4 py-2 bg-[#0F3F62]/10 border border-[#0F3F62]/30 rounded-lg text-[#0F3F62] text-sm">
                          {eco}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">Auto-detect (no manual selection)</span>
                    )}
                  </div>
                </div>

                {/* Test Styles */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-[#0F3F62] font-semibold text-lg mb-4">Test Generation Strategy</h3>
                  <div className="flex flex-wrap gap-2">
                    {repoData.testStyles && repoData.testStyles.length > 0 ? (
                      repoData.testStyles.map((style: string) => (
                        <span key={style} className="px-4 py-2 bg-[#0F3F62]/10 border border-[#0F3F62]/30 rounded-lg text-[#0F3F62] text-sm">
                          {style}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">Behavioral + STRIDE</span>
                    )}
                  </div>
                </div>

                {/* Selected Files */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-[#0F3F62] font-semibold text-lg mb-4">
                    Files to Audit
                    {repoData.selectedFiles && repoData.selectedFiles.length > 0 && (
                      <span className="ml-2 text-sm text-gray-500">({repoData.selectedFiles.length} files)</span>
                    )}
                  </h3>
                  <div className="max-h-[200px] overflow-y-auto">
                    {repoData.selectedFiles && repoData.selectedFiles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {repoData.selectedFiles.map((file: string) => (
                          <div key={file} className="flex items-center gap-2 text-sm">
                            <span className="text-[#0F3F62]">📄</span>
                            <span className="text-gray-600 truncate" title={file}>{file}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">All auditable files (auto-detected)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Auth Error Banner */}
            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-600 font-semibold">Authentication Required</p>
                  <p className="text-red-500/80 text-sm mt-1">{authError}</p>
                  <button
                    onClick={() => window.location.href = '/auth/github'}
                    className="mt-3 px-4 py-2 bg-red-100 border border-red-300 rounded-lg text-red-600 hover:bg-red-200 transition-colors text-sm"
                  >
                    Login with GitHub
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons or Progress */}
            {!hasStarted ? (
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-600 hover:text-[#0F3F62] hover:border-[#0F3F62] transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>

                <button
                  onClick={handleRunAudit}
                  disabled={isRunning}
                  className={`
                    relative px-8 py-4 rounded-lg font-semibold text-xl transition-all duration-200 flex items-center gap-3
                    ${isRunning
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30 hover:shadow-[#0F3F62]/50'
                    }
                  `}
                >
                  <Play className="w-6 h-6" />
                  {isRunning ? 'Starting Audit...' : 'Run Audit'}
                </button>
              </div>
            ) : (
              <div>
                {/* Tab Navigation */}
                <div className="flex justify-between items-center mb-6 border-b border-gray-200">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab('progress')}
                      className={`px-6 py-3 font-semibold transition-all ${
                        activeTab === 'progress'
                          ? 'text-[#0F3F62] border-b-2 border-[#0F3F62]'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Progress
                    </button>
                    {isComplete && !error && (
                      <button
                        onClick={() => setActiveTab('certificate')}
                        className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
                          activeTab === 'certificate'
                            ? 'text-[#0F3F62] border-b-2 border-[#0F3F62]'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Certificate
                        <span className="text-yellow-500">✨</span>
                      </button>
                    )}
                  </div>
                  {/* Cancel Button */}
                  {!isComplete && !isCancelled && jobId && (
                    <button
                      onClick={handleCancelAudit}
                      disabled={isCancelling}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isCancelling
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-600 border border-red-300 hover:bg-red-100'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      {isCancelling ? 'Cancelling...' : 'Cancel Audit'}
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                {activeTab === 'progress' && (
                  <div>
                    {/* Overall Progress */}
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-4">
                          <span className="text-[#0F3F62] font-semibold text-lg">Overall Progress</span>
                          {elapsedTime && !isComplete && (
                            <span className="text-gray-500 text-sm">
                              Elapsed: {elapsedTime}
                              {estimatedRemaining && (
                                <span className="ml-3 text-[#0F3F62]/70">{estimatedRemaining}</span>
                              )}
                            </span>
                          )}
                          {isComplete && elapsedTime && (
                            <span className="text-green-600 text-sm">
                              Completed in {elapsedTime}
                            </span>
                          )}
                        </div>
                        <span className="text-[#0F3F62] font-bold text-2xl">{overallProgress}%</span>
                      </div>
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0F3F62] to-[#1a5a8a] transition-all duration-500"
                          style={{ width: `${overallProgress}%` }}
                        />
                      </div>
                      {progress?.last_event && (
                        <p className="text-gray-500 text-xs mt-2">
                          Last activity: {progress.last_event}
                        </p>
                      )}
                    </div>

                    {/* Completion Actions */}
                    {isComplete && (
                      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
                        <h3 className="text-green-600 font-semibold text-xl mb-4">Audit Complete!</h3>
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleViewReport('html')}
                            className="flex items-center gap-2 px-6 py-3 bg-[#0F3F62] text-white rounded-lg font-semibold hover:bg-[#1a5a8a] transition-all"
                          >
                            <FileText className="w-5 h-5" />
                            View HTML Report
                          </button>
                          <button
                            onClick={() => handleViewReport('pdf')}
                            className="flex items-center gap-2 px-6 py-3 border border-[#0F3F62] text-[#0F3F62] rounded-lg font-semibold hover:bg-[#0F3F62]/10 transition-all"
                          >
                            <Download className="w-5 h-5" />
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <h3 className="text-yellow-600 font-semibold text-xl mb-2">Audit Cancelled</h3>
                        <p className="text-gray-600">The audit was cancelled by user request.</p>
                      </div>
                    )}

                    {error && !isCancelled && (
                      <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-xl">
                        <h3 className="text-red-600 font-semibold text-xl mb-3">Error</h3>
                        <p className="text-gray-700 mb-4">{error}</p>

                        {/* Actionable hints based on error type */}
                        <div className="text-sm text-gray-500 mb-4">
                          {error.includes('Authentication failed') && (
                            <p>💡 This repository may be private. Make sure you're logged in with GitHub OAuth and have access to this repo.</p>
                          )}
                          {error.includes('not found') && (
                            <p>💡 Check that the repository URL and branch name are correct.</p>
                          )}
                          {error.includes('timeout') && (
                            <p>💡 The operation timed out. This may be due to a large codebase or network issues. Try again.</p>
                          )}
                          {error.includes('Claude') && (
                            <p>💡 There was an issue with AI generation. Check your API keys and rate limits.</p>
                          )}
                        </div>

                        <button
                          onClick={handleRetry}
                          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 border border-red-300 rounded-lg hover:bg-red-200 transition-all"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'certificate' && (
                  <div className="relative">
                    <iframe
                      src={`/certificate?project=${encodeURIComponent(repoData.project)}&branch=${encodeURIComponent(repoData.branch)}`}
                      className="w-full h-[800px] rounded-xl border border-gray-200 bg-white shadow-lg"
                      title="Audit Certificate"
                    />
                    <div className="mt-4 flex gap-4 justify-end">
                      <button
                        onClick={() => handleViewReport('html')}
                        className="flex items-center gap-2 px-6 py-3 border border-[#0F3F62] text-[#0F3F62] rounded-lg font-semibold hover:bg-[#0F3F62]/10 transition-all"
                      >
                        <FileText className="w-5 h-5" />
                        Open in New Tab
                      </button>
                      <button
                        onClick={() => handleViewReport('pdf')}
                        className="flex items-center gap-2 px-6 py-3 bg-[#0F3F62] text-white rounded-lg font-semibold hover:bg-[#1a5a8a] transition-all"
                      >
                        <Download className="w-5 h-5" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
