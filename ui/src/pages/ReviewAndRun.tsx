import { useState, useEffect, useRef } from 'react'
import { useAuditProgress } from '../hooks/useAuditProgress'
import { useNeuronsBalance, approveNeurons } from '../hooks/useNeuronsBalance'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Play, FileText, Download, XCircle, RefreshCw, Coins, AlertCircle } from 'lucide-react'
import { ethers } from 'ethers'
import { neuronsToWei, UATU_OPERATOR_ADDRESS } from '../../../src/constants/neuronsToken'

import { ProjectData } from '../App'

// Declare window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface ReviewAndRunProps {
  onBack: () => void
  projectData: ProjectData
  initialJobId?: number
}

export default function ReviewAndRun({ onBack, projectData, initialJobId }: ReviewAndRunProps) {
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

  // Payment approval state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentStep, setPaymentStep] = useState<'estimate' | 'approve' | 'confirming' | 'approved'>('estimate')
  const [estimatedCost, setEstimatedCost] = useState<number>(0)
  const [reservationAmount, setReservationAmount] = useState<number>(0)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null)

  // Web3 state
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)

  const { balance } = useNeuronsBalance(address, provider)

  // Initialize Web3 connection
  useEffect(() => {
    const initWeb3 = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const browserProvider = new ethers.BrowserProvider(window.ethereum)
          const accounts = await browserProvider.send('eth_accounts', [])
          if (accounts && accounts.length > 0) {
            const userSigner = await browserProvider.getSigner()
            setProvider(browserProvider)
            setSigner(userSigner)
            setAddress(accounts[0])
          }
        } catch (err) {
          console.error('Failed to initialize Web3:', err)
        }
      }
    }

    initWeb3()

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0])
        } else {
          setAddress(null)
          setSigner(null)
        }
      })
    }
  }, [])

  const { progress, logs, jobLogs, isComplete, error, resetProgress } = useAuditProgress(
    projectData.name,
    projectData.components[0]?.config?.currentBranch || 'main',
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

  /**
   * Step 1: Show payment modal and estimate cost
   */
  const handleRunAudit = async () => {
    // Check if user has wallet connected
    if (!address || !signer) {
      setAuthError('Please connect your Web3 wallet first to pay for the audit with Neurons tokens')
      return
    }

    // Reset progress state
    resetProgress()
    setIsCancelled(false)
    smoothedRemainingRef.current = null
    lastProgressRef.current = 0
    lastDiffRef.current = 0
    setPaymentError(null)

    // Show payment modal and estimate cost
    setShowPaymentModal(true)
    setPaymentStep('estimate')

    try {
      // Estimate cost based on project
      const estimateRes = await fetch('/api/payments/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType: 'standard',
          sloc: 3000, // Rough estimate, backend will calculate actual
          aiTokens: 300000, // Rough estimate for standard audit
        }),
        credentials: 'include',
      })

      if (!estimateRes.ok) {
        const error = await estimateRes.json()
        throw new Error(error.error || 'Failed to estimate cost')
      }

      const estimate = await estimateRes.json()
      setEstimatedCost(estimate.totalEstimatedCostNeurons)
      setReservationAmount(estimate.reservationAmount)

      console.log('[PAYMENT] Cost estimated:', {
        estimated: estimate.totalEstimatedCostNeurons,
        reservation: estimate.reservationAmount,
        userBalance: balance,
      })

      // Check if user has sufficient balance
      if (balance && balance < estimate.reservationAmount) {
        setPaymentError(`Insufficient Neurons balance. You need ${estimate.reservationAmount.toFixed(2)} Neurons but only have ${balance.toFixed(2)} Neurons`)
        return
      }

      // Move to approval step
      setPaymentStep('approve')
    } catch (error: any) {
      console.error('[PAYMENT] Failed to estimate cost:', error)
      setPaymentError(error.message || 'Failed to estimate audit cost')
    }
  }

  /**
   * Step 2: Request user to approve Neurons spending
   */
  const handleApproveSpending = async () => {
    if (!signer || !address) {
      setPaymentError('Wallet not connected')
      return
    }

    setPaymentStep('approve')
    setPaymentError(null)

    try {
      console.log('[PAYMENT] Requesting approval for', reservationAmount, 'Neurons')

      // Request approval via MetaMask
      const amountWei = neuronsToWei(reservationAmount)
      const txHash = await approveNeurons(signer, UATU_OPERATOR_ADDRESS, amountWei)

      console.log('[PAYMENT] Approval transaction sent:', txHash)
      setApprovalTxHash(txHash)
      setPaymentStep('confirming')

      // Create payment reservation and confirm approval
      await handleConfirmReservation(txHash)
    } catch (error: any) {
      console.error('[PAYMENT] Approval failed:', error)
      if (error.message?.includes('Please switch to BNB Chain')) {
        setPaymentError('Please switch your wallet to BNB Chain (BSC) to approve Neurons spending')
      } else if (error.code === 'ACTION_REJECTED') {
        setPaymentError('Transaction rejected. Please approve the transaction in MetaMask to continue.')
      } else {
        setPaymentError(error.message || 'Failed to approve spending')
      }
    }
  }

  /**
   * Step 3: Confirm reservation with backend and start audit
   */
  const handleConfirmReservation = async (txHash: string) => {
    try {
      // Create payment reservation (this will be populated once we have jobId)
      // For now, we'll create it inline in the actual audit start

      // Start the audit with payment reservation
      setIsRunning(true)

      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectData.name,
          repo: projectData.components.find(c => c.type === 'github-repo')?.config?.fullName || '',
          branch: projectData.components.find(c => c.type === 'github-repo')?.config?.currentBranch || 'main',
          ecosystems: projectData.ecosystems || [],
          testStyles: projectData.testStyles || ['behavioral', 'stride'],
          selectedFiles: projectData.selectedFiles || [],
          components: projectData.components,
          ai: true,
          // Payment data
          paymentApprovalTxHash: txHash,
          walletAddress: address,
          estimatedSloc: 3000,
          estimatedAiTokens: 300000,
        }),
        credentials: 'include',
      })

      const result = await res.json()
      console.log('[PAYMENT] Audit queued with payment:', result)

      if (!res.ok || result.ok === false) {
        if (res.status === 401 || result.error === 'Authentication required') {
          setAuthError(result.hint || 'Please login with GitHub OAuth before starting an audit')
          return
        }
        setAuthError(result.error || 'Failed to start audit')
        return
      }

      setAuthError(null)

      if (result.job?.id) {
        setJobId(result.job.id)
      }

      setPaymentStep('approved')
      setShowPaymentModal(false)
      setStartTime(new Date())
      setHasStarted(true)
    } catch (error: any) {
      console.error('[PAYMENT] Failed to confirm reservation:', error)
      setPaymentError(error.message || 'Failed to start audit after payment approval')
    } finally {
      setIsRunning(false)
    }
  }

  const handleViewReport = (format: 'html' | 'pdf') => {
    // Include run timestamp for specific run access
    const runParam = progress?.timestamp ? `&run=${encodeURIComponent(progress.timestamp)}` : ''
    const url = `/report?project=${encodeURIComponent(projectData.name)}&branch=${encodeURIComponent(projectData.components[0]?.config?.currentBranch || 'main')}${runParam}&format=${format}`
    if (format === 'pdf') {
      // Download PDF directly
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectData.name}-${projectData.components[0]?.config?.currentBranch || 'main'}-audit.pdf`
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
      project: projectData.name,
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
    <div className="max-w-7xl mx-auto">
      {/* Step Indicator */}
      <nav className="flex items-center gap-3 mb-12">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
          <span className="text-slate-300">01 Identity</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-slate-300">02 Sources</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-slate-300">03 Configuration</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-indigo-600">04 Review & Deployment</span>
        </div>
      </nav>

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
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
              Deployment Review
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">
              Phase 04: Final validation prior to engine execution
            </p>

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
                      <span className="text-gray-800 ml-2 font-medium">{projectData.name}</span>
                    </div>
                    {projectData.components.some(c => c.type === 'deployed-contract') ? (
                      <>
                        <div>
                          <span className="text-gray-500">Network:</span>
                          <span className="text-gray-800 ml-2 font-medium capitalize">
                            {projectData.components.find(c => c.type === 'deployed-contract')?.config?.network || 'N/A'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Contract:</span>
                          <span className="text-gray-800 ml-2 font-medium break-all">
                            {projectData.components.find(c => c.type === 'deployed-contract')?.config?.address || 'N/A'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-gray-500">Branch:</span>
                          <span className="text-slate-900 font-black tracking-tight">{projectData.components[0]?.config?.currentBranch || 'main'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Repository:</span>
                          <span className="text-gray-800 ml-2 font-medium break-all">{projectData.components[0]?.config?.fullName || ''}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Ecosystems */}
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-[#0F3F62] font-semibold text-lg mb-4">Ecosystems</h3>
                  <div className="flex flex-wrap gap-2">
                    {projectData.ecosystems && projectData.ecosystems.length > 0 ? (
                      projectData.ecosystems.map((eco: string) => (
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
                    {projectData.testStyles && projectData.testStyles.length > 0 ? (
                      projectData.testStyles.map((style: string) => (
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
                    {projectData.selectedFiles && projectData.selectedFiles.length > 0 && (
                      <span className="ml-2 text-sm text-gray-500">({projectData.selectedFiles.length} files)</span>
                    )}
                  </h3>
                  <div className="max-h-[200px] overflow-y-auto">
                    {projectData.selectedFiles && projectData.selectedFiles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {projectData.selectedFiles?.map((file: string) => (
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
                    onClick={() => {
                      // GitHub can only be connected via Settings page after wallet authentication
                      window.location.href = '/settings?action=connect_github'
                    }}
                    className="mt-3 px-4 py-2 bg-red-100 border border-red-300 rounded-lg text-red-600 hover:bg-red-200 transition-colors text-sm"
                  >
                    Connect GitHub in Settings
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
                      className={`px-6 py-3 font-semibold transition-all ${activeTab === 'progress'
                        ? 'text-[#0F3F62] border-b-2 border-[#0F3F62]'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      Progress
                    </button>
                    {isComplete && !error && (
                      <button
                        onClick={() => setActiveTab('certificate')}
                        className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${activeTab === 'certificate'
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
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isCancelling
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
                      src={`/certificate?project=${encodeURIComponent(projectData.name)}&branch=${encodeURIComponent(projectData.components[0]?.config?.currentBranch || 'main')}${progress?.timestamp ? `&run=${encodeURIComponent(progress.timestamp)}` : ''}`}
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

        {/* Payment Approval Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-full">
                  <Coins className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Audit Payment</h2>
              </div>

              {paymentError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-600">{paymentError}</div>
                </div>
              )}

              {/* Estimate Step */}
              {paymentStep === 'estimate' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                  <p className="text-center text-slate-600">Estimating audit cost...</p>
                </div>
              )}

              {/* Approve Step */}
              {paymentStep === 'approve' && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-4">
                      To run this audit, you need to approve Uatu to spend Neurons tokens from your wallet.
                    </p>

                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Estimated Cost</span>
                        <span className="text-lg font-bold text-slate-900">{estimatedCost.toFixed(2)} Neurons</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Reservation Amount</span>
                        <span className="text-lg font-bold text-indigo-600">{reservationAmount.toFixed(2)} Neurons</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                        <span className="text-sm font-medium text-slate-600">Your Balance</span>
                        <span className="text-lg font-bold text-slate-900">{balance?.toFixed(2) || '0.00'} Neurons</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800">
                        <strong>How it works:</strong> You approve {reservationAmount.toFixed(2)} Neurons (with buffer). After the audit completes, we'll deduct only the actual cost (~{estimatedCost.toFixed(2)} Neurons). Any unused approval stays in your wallet.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPaymentModal(false)
                        setPaymentError(null)
                      }}
                      className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApproveSpending}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      Approve Spending
                    </button>
                  </div>
                </div>
              )}

              {/* Confirming Step */}
              {paymentStep === 'confirming' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                  <p className="text-center text-slate-600">
                    Confirming your approval and starting audit...
                  </p>
                  {approvalTxHash && (
                    <p className="text-xs text-center text-slate-500">
                      Transaction: {approvalTxHash.substring(0, 10)}...{approvalTxHash.substring(approvalTxHash.length - 8)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
