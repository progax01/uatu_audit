import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, FileCode, AlertTriangle } from 'lucide-react'
import logo from '../assets/icon_audits.png'

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

  // Ref for debounce timeout and abort controller
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Validate address format
  const isValidAddressFormat = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)

  // Debounced validation - validates and fetches source in one call
  const validateAndFetch = useCallback(async (address: string, network: Network) => {
    // Cancel previous request
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
      // Single API call that validates AND fetches source
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

      // Set contract info
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

      // Set fetched source info
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
        return // Request was cancelled, ignore
      }
      setError('Failed to validate contract')
      setValidationStatus('error')
    }
  }, [])

  // Handle address input change with debouncing
  const handleAddressChange = (address: string) => {
    setContractAddress(address)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Reset state for new input
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

    // Debounce: wait 500ms before validating
    debounceRef.current = setTimeout(() => {
      validateAndFetch(address, selectedNetwork)
    }, 500)
  }

  // Re-validate when network changes
  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network)

    // Clear previous state
    setValidationStatus('idle')
    setFetchStatus('idle')
    setContractInfo(null)
    setFetchedSource(null)
    setError(null)

    // Re-validate with new network if address is valid
    if (contractAddress && isValidAddressFormat(contractAddress)) {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      // Immediate validation on network change
      validateAndFetch(contractAddress, network)
    }
  }

  // Cleanup on unmount
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

  // Start the scan
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

      // Navigate to ReviewAndRun with the job
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

  const selectedNetworkData = networks.find(n => n.id === selectedNetwork)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1426] to-[#0a0f1f] relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Floating Blockchain Icons */}
      <FloatingIcon shortName="ETH" color="#627EEA" position="top-20 left-20" />
      <FloatingIcon shortName="ARB" color="#28A0F0" position="top-32 right-32" />
      <FloatingIcon shortName="POLY" color="#8247E5" position="top-64 left-12" />
      <FloatingIcon shortName="BNB" color="#F3BA2F" position="bottom-64 left-28" />
      <FloatingIcon shortName="BASE" color="#0052FF" position="top-48 right-16" />
      <FloatingIcon shortName="OP" color="#FF0420" position="bottom-32 right-24" />

      {/* Header */}
      <header className="relative z-10 border-b border-[#00ffff]/20 bg-[#0a0f1f]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onHomeClick}
          >
            <img src={logo} alt="UatuAudit Logo" className="w-12 h-12" />
            <span className="text-2xl font-bold text-white tracking-tight">UatuAudit</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <p className="text-[#00ffff] text-sm tracking-widest mb-4">UATU · AI SUPER-AUDIT</p>
          <h1 className="text-5xl font-bold text-white mb-4">
            Audit your smart contracts
            <br />
            with <span className="text-[#00ffff]">AI Super-Intelligence</span> .
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Deep reasoning engine that detects vulnerabilities, economic flaws, access-control issues
            and gas inefficiencies — long before mainnet.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0d1426]/90 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
          {/* Scan Mode Toggle & Badge */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex bg-[#1a1f2e] rounded-lg p-1">
              <button
                onClick={() => setScanMode('quick')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  scanMode === 'quick'
                    ? 'bg-[#0d1426] text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Quick Scan
              </button>
              <button
                onClick={() => setScanMode('full')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  scanMode === 'full'
                    ? 'bg-[#0d1426] text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Full Audit
              </button>
            </div>
            <span className="text-gray-500 text-sm">Read-only analysis · No write access</span>
          </div>

          {/* Network Selector */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-gray-400 text-sm font-medium tracking-wide">NETWORK</label>
              <span className="text-gray-500 text-sm">
                Verified contracts · {selectedNetworkData?.name} (Mainnet)
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkChange(network.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                    selectedNetwork === network.id
                      ? 'border-[#00ffff] bg-[#00ffff]/10 text-white'
                      : 'border-gray-700 bg-transparent text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: network.color }}
                  >
                    {network.shortName.slice(0, 3)}
                  </span>
                  <span className="text-sm font-medium">{network.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contract Address Input */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm font-medium tracking-wide block mb-3">
              CONTRACT ADDRESS
            </label>
            <div className="relative">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="0x1234... paste your contract"
                className={`w-full bg-[#1a1f2e] border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors font-mono pr-12 ${
                  validationStatus === 'valid'
                    ? 'border-green-500 focus:border-green-400'
                    : validationStatus === 'invalid' || validationStatus === 'error'
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-[#00ffff]'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validationStatus === 'validating' && (
                  <Loader2 className="w-5 h-5 text-[#00ffff] animate-spin" />
                )}
                {validationStatus === 'valid' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {(validationStatus === 'invalid' || validationStatus === 'error') && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            {/* Contract Info */}
            {contractInfo && validationStatus === 'valid' && fetchedSource && (
              <div className="mt-3 space-y-3">
                {/* Main contract info */}
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <p className="text-green-400 font-medium">{contractInfo.contractName}</p>
                      {fetchedSource.cached && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Cached</span>
                      )}
                    </div>
                    {contractInfo.explorerUrl && (
                      <a
                        href={contractInfo.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00ffff] hover:underline flex items-center gap-1 text-sm"
                      >
                        View on Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{contractInfo.compiler}</p>

                  {/* Files count */}
                  <div className="flex items-center gap-2 mt-2 text-gray-400 text-sm">
                    <FileCode className="w-4 h-4" />
                    <span>{fetchedSource.fileCount} source file{fetchedSource.fileCount !== 1 ? 's' : ''} fetched</span>
                  </div>
                </div>

                {/* Proxy warning */}
                {contractInfo.isProxy && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-400 text-sm font-medium">Proxy Contract Detected</span>
                    </div>
                    {contractInfo.implementationAddress && (
                      <p className="text-gray-400 text-sm mt-1 ml-6">
                        Implementation: {contractInfo.implementationName || contractInfo.implementationAddress.slice(0, 10) + '...'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}

            {/* Helper Text */}
            {!error && validationStatus === 'idle' && (
              <p className="text-gray-500 text-sm mt-2">
                We run an AI surface scan on the verified source code from the selected chain's explorer.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleStartScan}
            disabled={validationStatus !== 'valid' || isStarting}
            className={`w-full relative group ${
              validationStatus !== 'valid' || isStarting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/30 to-[#00e6e6]/30 rounded-xl blur-md group-hover:blur-lg transition-all" />
            <div className="relative bg-gradient-to-r from-[#00ffff]/20 to-[#00e6e6]/20 hover:from-[#00ffff]/30 hover:to-[#00e6e6]/30 border border-[#00ffff]/50 text-[#00ffff] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2">
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting Scan...
                </>
              ) : (
                <>
                  Start {scanMode === 'quick' ? 'Quick Scan' : 'Full Audit'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </div>
          </button>
        </div>

        {/* Footer - Trusted Ecosystems */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 text-sm tracking-widest mb-6">TRUSTED ACROSS EVM ECOSYSTEMS</p>
          <div className="flex items-center justify-center gap-8 text-gray-500">
            {networks.map((network) => (
              <span key={network.id} className="text-sm font-medium tracking-wide">
                {network.name.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Floating Icon Component
function FloatingIcon({ shortName, color, position }: { shortName: string; color: string; position: string }) {
  return (
    <div className={`absolute ${position} z-0 opacity-60`}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
        style={{
          backgroundColor: `${color}20`,
          border: `2px solid ${color}40`
        }}
      >
        {shortName}
      </div>
    </div>
  )
}
