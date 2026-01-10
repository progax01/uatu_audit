import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, XCircle, FileCode, AlertTriangle, Shield, Clock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

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

export default function ScanContract({ onBack, onStartAudit, onQuickScanComplete }: ScanContractProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('quick')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum')
  const [contractAddress, setContractAddress] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [fetchedSource, setFetchedSource] = useState<FetchedSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [quickScanResult, setQuickScanResult] = useState<QuickScanResult | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isValidAddressFormat = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)

  const validateAndFetch = useCallback(async (address: string, network: Network) => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()

    setValidationStatus('validating')
    setContractInfo(null)
    setFetchedSource(null)
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
    }
  }, [])

  const handleStartScan = async () => {
    if (!contractAddress || validationStatus !== 'valid') return

    setIsStarting(true)
    setError(null)
    setQuickScanResult(null)

    try {
      const response = await fetch('/scan/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contractAddress, network: selectedNetwork, scanMode }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to start scan')

      // For quick scans, result is returned directly
      if (scanMode === 'quick' && data.quickScanResult) {
        const result = {
          ...data.quickScanResult,
          contractName: contractInfo?.contractName,
          address: contractAddress,
          network: selectedNetwork,
          cached: data.cached,
        }
        setQuickScanResult(result)
        setIsStarting(false)
        if (onQuickScanComplete) {
          onQuickScanComplete(result)
        }
        return
      }

      // For full audits, navigate to job polling page
      onStartAudit({ project: data.projectName, branch: 'main', jobId: data.job.id })
    } catch (err: any) {
      setError(err.message || 'Failed to start scan')
      setIsStarting(false)
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

        {/* Submit */}
        <button
          onClick={handleStartScan}
          disabled={validationStatus !== 'valid' || isStarting}
          className="w-full btn-primary h-12 mt-4"
        >
          {isStarting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {scanMode === 'quick' ? 'Scanning...' : 'Starting...'}
            </>
          ) : (
            <>
              Start Scan
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Quick Scan Result */}
        {quickScanResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Shield className={`w-8 h-8 ${
                  quickScanResult.riskLevel === 'SAFE' ? 'text-emerald-500' :
                  quickScanResult.riskLevel === 'LOW' ? 'text-emerald-400' :
                  quickScanResult.riskLevel === 'MEDIUM' ? 'text-amber-500' :
                  quickScanResult.riskLevel === 'HIGH' ? 'text-orange-500' :
                  'text-rose-500'
                }`} />
                <div>
                  <h3 className="font-bold text-slate-900">Quick Scan Complete</h3>
                  <p className="text-xs text-slate-500">{quickScanResult.contractName || contractInfo?.contractName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {quickScanResult.cached && (
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1">
                    <Zap size={12} />
                    Cached
                  </span>
                )}
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1">
                  <Clock size={12} />
                  {(quickScanResult.scanDuration / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-6 mb-6">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black ${
                quickScanResult.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                quickScanResult.score >= 60 ? 'bg-amber-100 text-amber-700' :
                quickScanResult.score >= 40 ? 'bg-orange-100 text-orange-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {quickScanResult.score}
              </div>
              <div>
                <div className={`text-lg font-bold ${
                  quickScanResult.riskLevel === 'SAFE' ? 'text-emerald-600' :
                  quickScanResult.riskLevel === 'LOW' ? 'text-emerald-500' :
                  quickScanResult.riskLevel === 'MEDIUM' ? 'text-amber-600' :
                  quickScanResult.riskLevel === 'HIGH' ? 'text-orange-600' :
                  'text-rose-600'
                }`}>
                  {quickScanResult.riskLevel} Risk
                </div>
                <p className="text-sm text-slate-600 mt-1">{quickScanResult.summary}</p>
              </div>
            </div>

            {/* Vulnerabilities */}
            {quickScanResult.vulnerabilities.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-3">
                  {quickScanResult.vulnerabilities.length} Issues Found
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {quickScanResult.vulnerabilities.map((vuln, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      vuln.severity === 'critical' ? 'bg-rose-50 border-rose-200' :
                      vuln.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                      vuln.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                      vuln.severity === 'low' ? 'bg-blue-50 border-blue-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          vuln.severity === 'critical' ? 'bg-rose-200 text-rose-800' :
                          vuln.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                          vuln.severity === 'medium' ? 'bg-amber-200 text-amber-800' :
                          vuln.severity === 'low' ? 'bg-blue-200 text-blue-800' :
                          'bg-slate-200 text-slate-800'
                        }`}>
                          {vuln.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{vuln.title}</span>
                      </div>
                      <p className="text-xs text-slate-600">{vuln.description}</p>
                      {vuln.location && (
                        <p className="text-xs text-slate-500 mt-1 font-mono">{vuln.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contract Analysis */}
            {quickScanResult.contractAnalysis && (
              <div className="border-t border-slate-100 pt-4 mt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Contract Analysis</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">Purpose:</span>
                    <p className="text-slate-700 font-medium">{quickScanResult.contractAnalysis.purpose}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">Architecture:</span>
                    <p className="text-slate-700 font-medium">{quickScanResult.contractAnalysis.architecture}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">SLOC:</span>
                    <p className="text-slate-700 font-medium">{quickScanResult.contractAnalysis.sloc}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">Functions:</span>
                    <p className="text-slate-700 font-medium">{quickScanResult.contractAnalysis.functions}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Again Button */}
            <button
              onClick={() => setQuickScanResult(null)}
              className="w-full mt-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Scan Another Contract
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
