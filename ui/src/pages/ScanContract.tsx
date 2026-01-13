import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, XCircle, FileCode, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import ScanProgressPanel from '../components/ScanProgressPanel'

import type { ProjectData } from '../App'

interface QuickScanResult {
  success: boolean
  score: number
  grade: string
  riskLevel: string
  vulnerabilities: Array<{
    id: string
    severity: string
    title: string
    description: string
    location?: string
    recommendation: string
  }>
  summary: string
  scanDuration: number
  contractAnalysis?: {
    purpose: string
    architecture: string
    dependencies: string[]
    accessControl: string
    stateVariables: number
    functions: number
    externalCalls: number
    sloc: number
  }
  contractName?: string
  address?: string
  network?: string
  timestamp?: string
  cached?: boolean
}

interface ScanContractProps {
  onBack: () => void
  onStartAudit: (data: { project: string; branch: string; jobId: number }) => void
  onQuickScanComplete?: (result: QuickScanResult) => void
  projectData: ProjectData
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>
}

type ScanMode = 'quick' | 'full'
type Network = 'ethereum' | 'arbitrum' | 'polygon' | 'base' | 'bnb' | 'optimism'
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error'

const networks: { id: Network; name: string; color: string }[] = [
  { id: 'ethereum', name: 'Ethereum', color: '#627EEA' },
  { id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0' },
  { id: 'polygon', name: 'Polygon', color: '#8247E5' },
  { id: 'base', name: 'Base', color: '#0052FF' },
  { id: 'bnb', name: 'BNB Chain', color: '#F3BA2F' },
  { id: 'optimism', name: 'Optimism', color: '#FF0420' },
]

interface ContractInfo {
  isContract: boolean
  isVerified: boolean
  contractName?: string
  compiler?: string
  isProxy?: boolean
  implementationAddress?: string
}

interface FetchedSource {
  contractName: string
  fileCount: number
  isProxy: boolean
}

interface ExistingAudit {
  jobId: string
  completedAt: string
  score: number
  grade: string
  vulnerabilityCount: number
}

interface Phase {
  name: string
  label: string
  status: 'pending' | 'active' | 'complete'
  pct: number
}

interface ScanProgress {
  pct: number
  message: string
  status: string
  jobId?: string
  phases?: Phase[]
  logs?: string[]
  contractInfo?: {
    sloc?: number
    contractName?: string
    network?: string
  }
}

export default function ScanContract({ onBack, onStartAudit, onQuickScanComplete }: ScanContractProps) {
  const navigate = useNavigate()
  const [scanMode, setScanMode] = useState<ScanMode>('quick')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum')
  const [contractAddress, setContractAddress] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [fetchedSource, setFetchedSource] = useState<FetchedSource | null>(null)
  const [existingAudit, setExistingAudit] = useState<ExistingAudit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isValidAddressFormat = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)

  // Poll for job status (used when reconnecting to a running job)
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/scan/job-status/${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          console.error('Polling error:', data.error)
          return
        }

        // Update progress
        setScanProgress(prev => ({
          ...prev!,
          pct: data.progressPct || prev?.pct || 0,
          message: data.progressMessage || prev?.message || 'Processing...',
          status: data.status,
          jobId: data.jobId,
        }))

        // Handle completion
        if (data.status === 'completed' && data.redirectUrl) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsStarting(false)
          setScanProgress(null)
          navigate(data.redirectUrl)
          return
        }

        // Handle failure
        if (data.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsStarting(false)
          setScanProgress(null)
          setError(data.error || 'Scan failed')
          return
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    // Poll immediately, then every 2 seconds
    pollStatus()
    pollingIntervalRef.current = setInterval(pollStatus, 2000)
  }, [navigate])

  const validateAndFetch = useCallback(async (address: string, network: Network) => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()

    setValidationStatus('validating')
    setContractInfo(null)
    setFetchedSource(null)
    setExistingAudit(null)
    setError(null)

    try {
      const response = await fetch('/scan/validate-and-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, network }),
        signal: abortControllerRef.current.signal,
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Validation failed')
        setValidationStatus('error')
        return
      }

      if (!data.isContract) {
        setError('Address is not a contract')
        setValidationStatus('invalid')
        return
      }

      if (!data.isVerified) {
        setError('Contract not verified on explorer')
        setValidationStatus('invalid')
        setContractInfo(data)
        return
      }

      setContractInfo({
        isContract: data.isContract,
        isVerified: data.isVerified,
        contractName: data.contractName,
        compiler: data.compiler,
        isProxy: data.isProxy,
        implementationAddress: data.implementationAddress,
      })

      setFetchedSource({
        contractName: data.contractName,
        fileCount: data.fileCount || 0,
        isProxy: data.isProxy || false,
      })

      // Check if there's an existing completed audit for this contract
      if (data.existingAudit) {
        setExistingAudit({
          jobId: data.existingAudit.jobId,
          completedAt: data.existingAudit.completedAt,
          score: data.existingAudit.score,
          grade: data.existingAudit.grade,
          vulnerabilityCount: data.existingAudit.vulnerabilityCount,
        })
      }

      // Check if there's already a running job for this contract
      if (data.runningJob) {
        setIsStarting(true)
        setScanProgress({
          pct: data.runningJob.progressPct || 0,
          message: data.runningJob.progressMessage || 'Scan in progress...',
          status: data.runningJob.status,
          jobId: data.runningJob.jobId,
          phases: [],
          logs: [],
          contractInfo: {
            contractName: data.contractName,
            network,
          },
        })
        // Start polling for status updates
        startPolling(data.runningJob.jobId)
      }

      setValidationStatus('valid')
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError('Failed to validate contract')
      setValidationStatus('error')
    }
  }, [])

  const handleAddressChange = (address: string) => {
    setContractAddress(address)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!address) {
      setValidationStatus('idle')
      setContractInfo(null)
      setExistingAudit(null)
      setError(null)
      return
    }
    if (!isValidAddressFormat(address)) {
      setValidationStatus('idle')
      setError(null)
      return
    }
    debounceRef.current = setTimeout(() => validateAndFetch(address, selectedNetwork), 500)
  }

  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network)
    setValidationStatus('idle')
    setContractInfo(null)
    setFetchedSource(null)
    setExistingAudit(null)
    setError(null)
    if (contractAddress && isValidAddressFormat(contractAddress)) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      validateAndFetch(contractAddress, network)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [])

  const handleStartScan = async () => {
    if (!contractAddress || validationStatus !== 'valid') return

    setIsStarting(true)
    setError(null)
    setScanProgress(null)

    try {
      const response = await fetch('/scan/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contractAddress, network: selectedNetwork, scanMode }),
      })

      // For quick scans, handle SSE streaming
      if (scanMode === 'quick') {
        const contentType = response.headers.get('content-type') || ''

        // If it's SSE (new flow)
        if (contentType.includes('text/event-stream')) {
          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  // Update progress with all new fields
                  setScanProgress({
                    pct: data.progressPct || 0,
                    message: data.message || 'Processing...',
                    status: data.status || 'pending',
                    jobId: data.jobId,
                    phases: data.phases || [],
                    logs: data.logs || [],
                    contractInfo: data.contractInfo,
                  })

                  // Handle completion
                  if (data.status === 'completed' && data.redirectUrl) {
                    setIsStarting(false)
                    setScanProgress(null)
                    navigate(data.redirectUrl)
                    return
                  }

                  // Handle error
                  if (data.status === 'failed') {
                    throw new Error(data.error || data.message || 'Scan failed')
                  }
                } catch (parseError) {
                  // Ignore JSON parse errors for malformed events
                  console.warn('Failed to parse SSE event:', line)
                }
              }
            }
          }
        }
        // If it's JSON (cached result or error)
        else if (contentType.includes('application/json')) {
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || data.message || 'Failed to start scan')

          // Cached result - redirect directly
          if (data.cached && data.redirectUrl) {
            navigate(data.redirectUrl)
            return
          }

          // Legacy inline result (shouldn't happen with new backend)
          if (data.quickScanResult) {
            const result = {
              ...data.quickScanResult,
              contractName: contractInfo?.contractName,
              address: contractAddress,
              network: selectedNetwork,
              cached: data.cached,
            }
            if (onQuickScanComplete) {
              onQuickScanComplete(result)
            }
            // Still redirect to audit page if we have a jobId
            if (data.jobId) {
              navigate(`/audit/${data.jobId}`)
            }
            return
          }
        }

        setIsStarting(false)
        return
      }

      // For full audits, navigate to job polling page
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to start scan')
      onStartAudit({ project: data.projectName, branch: 'main', jobId: data.job.id })
    } catch (err: any) {
      setError(err.message || 'Failed to start scan')
      setIsStarting(false)
      setScanProgress(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-reveal">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-8">
        <ArrowLeft size={16} />
        <span className="text-xs font-bold">Back</span>
      </button>

      {/* Title */}
      <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-8">
        Scan <span className="text-indigo-600">Contract</span>
      </h1>

      {/* Form */}
      <div className="space-y-6">
        {/* Network Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-3">Network</label>
          <div className="flex flex-wrap gap-2">
            {networks.map(network => (
              <button
                key={network.id}
                onClick={() => handleNetworkChange(network.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                  selectedNetwork === network.id
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: network.color }} />
                {network.name}
              </button>
            ))}
          </div>
        </div>

        {/* Contract Address */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-3">Contract Address</label>
          <div className="relative">
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="0x..."
              className={`w-full h-12 px-4 pr-12 rounded-xl border text-sm font-mono transition-all focus:outline-none ${
                validationStatus === 'valid'
                  ? 'border-emerald-300 bg-emerald-50'
                  : validationStatus === 'invalid' || validationStatus === 'error'
                  ? 'border-rose-300 bg-rose-50'
                  : 'border-slate-200 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50'
              }`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {validationStatus === 'validating' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
              {validationStatus === 'valid' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {(validationStatus === 'invalid' || validationStatus === 'error') && <XCircle className="w-5 h-5 text-rose-500" />}
            </div>
          </div>
          {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
        </div>

        {/* Contract Info (when valid) */}
        {validationStatus === 'valid' && contractInfo && fetchedSource && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <FileCode size={18} className="text-emerald-600" />
              <span className="font-bold text-emerald-900">{contractInfo.contractName}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-emerald-700">
              <span>{contractInfo.compiler}</span>
              <span>{fetchedSource.fileCount} files</span>
            </div>
            {contractInfo.isProxy && (
              <div className="flex items-center gap-2 mt-3 text-xs text-amber-600">
                <AlertTriangle size={14} />
                <span>Proxy contract - will analyze implementation</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Scan Mode */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-3">Scan Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setScanMode('quick')}
              className={`p-4 rounded-xl border text-left transition-all ${
                scanMode === 'quick'
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className={`text-sm font-bold ${scanMode === 'quick' ? 'text-indigo-700' : 'text-slate-900'}`}>
                Quick Scan
              </div>
              <div className="text-xs text-slate-400 mt-1">Surface vulnerabilities</div>
            </button>
            <button
              onClick={() => setScanMode('full')}
              className={`p-4 rounded-xl border text-left transition-all ${
                scanMode === 'full'
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className={`text-sm font-bold ${scanMode === 'full' ? 'text-indigo-700' : 'text-slate-900'}`}>
                Full Audit
              </div>
              <div className="text-xs text-slate-400 mt-1">Deep logic analysis</div>
            </button>
          </div>
        </div>

        {/* Submit / Progress */}
        {isStarting && scanProgress ? (
          <div className="mt-6">
            <ScanProgressPanel
              jobId={scanProgress.jobId || ''}
              status={scanProgress.status}
              progressPct={scanProgress.pct}
              message={scanProgress.message}
              phases={scanProgress.phases || []}
              logs={scanProgress.logs || []}
              contractInfo={scanProgress.contractInfo || {
                contractName: contractInfo?.contractName,
                network: selectedNetwork,
              }}
              isProxy={contractInfo?.isProxy}
            />
          </div>
        ) : existingAudit ? (
          <div className="space-y-3 mt-4">
            {/* Existing Audit Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Existing Audit Found
                </span>
                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  existingAudit.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  existingAudit.score >= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {existingAudit.grade} ({existingAudit.score}/100)
                </div>
              </div>
              <p className="text-xs text-indigo-700">
                This contract was audited on {new Date(existingAudit.completedAt).toLocaleDateString()}.
                {existingAudit.vulnerabilityCount > 0
                  ? ` Found ${existingAudit.vulnerabilityCount} issue${existingAudit.vulnerabilityCount > 1 ? 's' : ''}.`
                  : ' No issues found.'}
              </p>
            </motion.div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/audit/${existingAudit.jobId}`)}
                className="flex-1 btn-primary h-12"
              >
                <CheckCircle size={16} />
                View Existing Audit
              </button>
              <button
                onClick={() => {
                  setExistingAudit(null)
                }}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                Run New Scan
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartScan}
            disabled={validationStatus !== 'valid' || isStarting}
            className="w-full btn-primary h-12 mt-4"
          >
            {isStarting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {scanMode === 'quick' ? 'Initializing...' : 'Starting...'}
              </>
            ) : (
              <>
                Start Scan
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}

      </div>
    </div>
  )
}
