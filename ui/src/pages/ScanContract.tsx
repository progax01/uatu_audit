import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, FileCode, AlertTriangle, Sparkles, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'

interface ScanContractProps {
  onBack: () => void
  onHomeClick: () => void
  onStartAudit: (data: { project: string; branch: string; jobId: number }) => void
}

type ScanMode = 'quick' | 'full'
type Network = 'arbitrum' | 'ethereum' | 'polygon' | 'base' | 'bnb' | 'optimism'
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error'
type FetchStatus = 'idle' | 'fetching' | 'fetched' | 'error'

const networks: { id: Network; name: string; shortName: string; color: string }[] = [
  { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', color: '#28A0F0' },
  { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', shortName: 'POLY', color: '#8247E5' },
  { id: 'base', name: 'Base', shortName: 'BASE', color: '#0052FF' },
  { id: 'bnb', name: 'BNB Chain', shortName: 'BNB', color: '#F3BA2F' },
  { id: 'optimism', name: 'Optimism', shortName: 'OP', color: '#FF0420' },
]

interface ContractInfo {
  isContract: boolean
  isVerified: boolean
  contractName?: string
  compiler?: string
  explorerUrl?: string
  isProxy?: boolean
  implementationAddress?: string
  implementationName?: string
}

interface FetchedSource {
  contractName: string
  compiler: string
  files: string[]
  fileCount: number
  isProxy: boolean
  implementationAddress?: string
  cached: boolean
}

export default function ScanContract({ onBack, onHomeClick, onStartAudit }: ScanContractProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('quick')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('arbitrum')
  const [contractAddress, setContractAddress] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [fetchedSource, setFetchedSource] = useState<FetchedSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isValidAddressFormat = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)

  const validateAndFetch = useCallback(async (address: string, network: Network) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setValidationStatus('validating')
    setFetchStatus('idle')
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
        setError('Address is not a contract (EOA)')
        setValidationStatus('invalid')
        return
      }

      if (!data.isVerified) {
        setError('Contract source code not verified on explorer')
        setValidationStatus('invalid')
        setContractInfo(data)
        return
      }

      setContractInfo({
        isContract: data.isContract,
        isVerified: data.isVerified,
        contractName: data.contractName,
        compiler: data.compiler,
        explorerUrl: data.explorerUrl,
        isProxy: data.isProxy,
        implementationAddress: data.implementationAddress,
        implementationName: data.implementationName,
      })

      setFetchedSource({
        contractName: data.contractName,
        compiler: data.compiler,
        files: data.files || [],
        fileCount: data.fileCount || 0,
        isProxy: data.isProxy || false,
        implementationAddress: data.implementationAddress,
        cached: data.cached || false,
      })

      setValidationStatus('valid')
      setFetchStatus('fetched')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return
      }
      setError('Failed to validate contract')
      setValidationStatus('error')
    }
  }, [])

  const handleAddressChange = (address: string) => {
    setContractAddress(address)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    if (!address) {
      setValidationStatus('idle')
      setFetchStatus('idle')
      setContractInfo(null)
      setFetchedSource(null)
      setError(null)
      return
    }
    if (!isValidAddressFormat(address)) {
      setValidationStatus('idle')
      setFetchStatus('idle')
      setError(null)
      return
    }
    debounceRef.current = setTimeout(() => {
      validateAndFetch(address, selectedNetwork)
    }, 500)
  }

  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network)
    setValidationStatus('idle')
    setFetchStatus('idle')
    setContractInfo(null)
    setFetchedSource(null)
    setError(null)
    if (contractAddress && isValidAddressFormat(contractAddress)) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      validateAndFetch(contractAddress, network)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleStartScan = async () => {
    if (!contractAddress || validationStatus !== 'valid') {
      return
    }

    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch('/scan/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: contractAddress,
          network: selectedNetwork,
          scanMode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start scan')
      }

      onStartAudit({
        project: data.projectName,
        branch: 'main',
        jobId: data.job.id,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to start scan')
      setIsStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex flex-col selection:bg-indigo-500/20 relative overflow-hidden">
      <MouseTooltip />

      {/* Background Atmosphere */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-dot-pattern opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-10 shrink-0 z-10 bg-white/70 backdrop-blur-xl border-b border-black/[0.03]">
        <div className="flex items-center gap-8">
          <div onClick={onHomeClick} className="cursor-pointer">
            <img src={logo} alt="Uatu Security" className="h-9" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100/50">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Global Scan Active</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-10 py-16 z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

          {/* Left Column: Form */}
          <div className="lg:col-span-7 space-y-12">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-4 block">Automated Verification</span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                Direct Contract <span className="text-slate-400">Analysis.</span>
              </h1>
              <p className="text-base text-slate-500 font-medium leading-relaxed">
                Connect your deployed contract directly via blockchain explorer integration.
                Our AI Super-Audit engine performs deep reasoning on verified source code.
              </p>
            </motion.div>

            <div className="card-premium !p-8 space-y-10 border-black/[0.04] bg-white/50 backdrop-blur-xl">
              {/* Scan Mode */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Analysis Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'quick', label: 'Quick Scan', desc: 'Focus on surface vulnerabilities' },
                    { id: 'full', label: 'Full Audit', desc: 'Deep economic logic checks' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setScanMode(mode.id as ScanMode)}
                      className={`text-left p-4 rounded-xl border transition-all ${scanMode === mode.id
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                        : 'border-black/[0.05] hover:bg-slate-50'
                        }`}
                    >
                      <div className={`font-black text-xs uppercase tracking-wide ${scanMode === mode.id ? 'text-indigo-700' : 'text-slate-900'}`}>
                        {mode.label}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {mode.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Network Grid */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Deployment Ecosystem</label>
                <div className="grid grid-cols-3 gap-3">
                  {networks.map(network => (
                    <button
                      key={network.id}
                      onClick={() => handleNetworkChange(network.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${selectedNetwork === network.id
                        ? 'bg-white border-indigo-600 shadow-md scale-[1.02]'
                        : 'border-black/[0.05] bg-slate-50/50 hover:bg-white'
                        }`}
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black text-white shadow-sm" style={{ backgroundColor: network.color }}>
                        {network.shortName}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${selectedNetwork === network.id ? 'text-slate-900' : 'text-slate-400'}`}>
                        {network.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address Input */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Contract Address</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-400 transition-colors">
                    <Shield size={18} strokeWidth={2.5} />
                  </div>
                  <input
                    type="text"
                    value={contractAddress}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="0x..."
                    className={`w-full bg-slate-50 border rounded-xl py-4 pl-12 pr-12 text-sm font-mono tracking-wider focus:outline-none transition-all ${validationStatus === 'valid' ? 'border-emerald-200 bg-emerald-50/20' :
                      validationStatus === 'invalid' ? 'border-rose-200 bg-rose-50/20' :
                        'border-black/[0.05] focus:bg-white focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-500/5'
                      }`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {validationStatus === 'validating' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                    {validationStatus === 'valid' && <CheckCircle className="w-5 h-5 text-emerald-500 transition-all scale-110" />}
                    {validationStatus === 'invalid' && <XCircle className="w-5 h-5 text-rose-500 transition-all scale-110" />}
                  </div>
                </div>
                {error && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">{error}</p>}
              </div>

              {/* Action */}
              <button
                onClick={handleStartScan}
                disabled={validationStatus !== 'valid' || isStarting}
                className="w-full btn-primary !py-5 shadow-2xl shadow-indigo-500/20"
              >
                {isStarting ? (
                  <>
                    <Loader2 size={18} strokeWidth={3} className="animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    Initiate Security Sweep
                    <ArrowRight size={18} strokeWidth={3} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Dynamic Feedback */}
          <div className="lg:col-span-5 pt-10">
            <AnimatePresence mode="wait">
              {contractInfo && validationStatus === 'valid' && fetchedSource ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="card-premium !p-0 overflow-hidden border-emerald-100 bg-emerald-50/10">
                    <div className="p-6 border-b border-black/[0.03] bg-white/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                          <FileCode size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">{contractInfo.contractName}</h3>
                          <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">Verified Source Sync</p>
                        </div>
                      </div>
                      {contractInfo.explorerUrl && (
                        <a href={contractInfo.explorerUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-emerald-100 rounded-lg transition-all text-emerald-600">
                          <ExternalLink size={16} strokeWidth={2.5} />
                        </a>
                      )}
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiler Version</span>
                        <span className="text-[10px] font-mono text-slate-900 font-bold">{contractInfo.compiler}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Count</span>
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{fetchedSource.fileCount} Assets</span>
                      </div>
                      {contractInfo.isProxy && (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100/50 flex items-start gap-4">
                          <div className="mt-0.5"><AlertTriangle size={14} className="text-amber-500" strokeWidth={3} /></div>
                          <div>
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Proxy Implementation</p>
                            <p className="text-[9px] text-amber-600/70 font-bold uppercase tracking-widest leading-relaxed mt-1">
                              Analysis will follow implementation at {contractInfo.implementationAddress?.slice(0, 10)}...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Trust Badge */}
                  <div className="card-premium !p-6 flex items-center gap-6 bg-white/40">
                    <div className="w-12 h-12 rounded-2xl glass-liquid border-white/40 flex items-center justify-center text-indigo-500">
                      <Sparkles size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 tracking-tight uppercase tracking-wider">High Fidelity Mode</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Full context window enabled for {contractInfo.contractName}</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center text-center p-20 border-2 border-dashed border-black/[0.03] rounded-[40px]"
                >
                  <div className="w-20 h-20 rounded-[32px] bg-white shadow-premium flex items-center justify-center mb-8 border border-black/[0.02]">
                    <Shield size={32} className="text-indigo-100" strokeWidth={1} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 opacity-60">Ready for Sweep</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">
                    Input a verified contract address to begin the AI analysis sequence.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}
