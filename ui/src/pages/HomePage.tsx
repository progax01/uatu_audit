import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, FileCode, AlertTriangle } from 'lucide-react'
import logo from '../assets/logo.svg'

// GitHub Icon SVG Component
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

interface HomePageProps {
  onGetStarted: () => void
  onScanContract: () => void
  onStartAudit?: (data: { project: string; branch: string; jobId: number }) => void
}

type TabType = 'github' | 'quickscan'
type Network = 'arbitrum' | 'ethereum' | 'polygon' | 'bnb' | 'optimism'
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error'

const networks: { id: Network; name: string; color: string }[] = [
  { id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0' },
  { id: 'ethereum', name: 'Ethereum', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', color: '#8247E5' },
  { id: 'bnb', name: 'BNB', color: '#F3BA2F' },
  { id: 'optimism', name: 'Optimism', color: '#FF0420' },
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

// Robot Mascot SVG Component - Cute 3D style
function RobotMascot() {
  return (
    <svg viewBox="0 0 320 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Definitions for gradients */}
      <defs>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a8d8ea" />
          <stop offset="100%" stopColor="#6bb7d4" />
        </linearGradient>
        <linearGradient id="headGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c5e8f2" />
          <stop offset="100%" stopColor="#7fc8dc" />
        </linearGradient>
        <linearGradient id="visorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a3a5c" />
          <stop offset="100%" stopColor="#0d1f33" />
        </linearGradient>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b8e6f2" />
          <stop offset="100%" stopColor="#7dd3e8" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Feet shadow */}
      <ellipse cx="200" cy="285" rx="55" ry="10" fill="#4a9bb8" opacity="0.2"/>

      {/* Robot Legs */}
      <ellipse cx="170" cy="265" rx="22" ry="28" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>
      <ellipse cx="230" cy="265" rx="22" ry="28" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>

      {/* Robot Body */}
      <ellipse cx="200" cy="190" rx="55" ry="65" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>

      {/* Robot Arms */}
      <ellipse cx="130" cy="185" rx="18" ry="38" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>
      <ellipse cx="270" cy="185" rx="18" ry="38" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>

      {/* Body logo/emblem */}
      <ellipse cx="200" cy="180" rx="28" ry="32" fill="#e8f6fa" stroke="#4a9bb8" strokeWidth="2"/>
      {/* Uatu symbol on body */}
      <path d="M182 172 Q200 195 218 172" stroke="#4a9bb8" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="188" cy="176" r="3" fill="#4a9bb8"/>
      <circle cx="212" cy="176" r="3" fill="#4a9bb8"/>

      {/* Robot Head - positioned to connect with body */}
      <g transform="translate(130, 5)">
        {/* Head outer ring/helmet */}
        <ellipse cx="70" cy="70" rx="68" ry="65" fill="url(#headGradient)" stroke="#4a9bb8" strokeWidth="3"/>
        {/* Helmet rim */}
        <ellipse cx="70" cy="70" rx="60" ry="57" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.5"/>

        {/* Visor/Face screen */}
        <ellipse cx="70" cy="72" rx="48" ry="45" fill="url(#visorGradient)" stroke="#1a3a5c" strokeWidth="2"/>

        {/* Glowing U symbol - Uatu eyes */}
        <g filter="url(#glow)">
          <path d="M42 52 Q42 88 70 100 Q98 88 98 52"
                stroke="#00e5ff" strokeWidth="7" fill="none" strokeLinecap="round"/>
          <path d="M42 52 Q42 88 70 100 Q98 88 98 52"
                stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7"/>
        </g>

        {/* Ear pieces */}
        <ellipse cx="5" cy="70" rx="14" ry="22" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>
        <ellipse cx="135" cy="70" rx="14" ry="22" fill="url(#bodyGradient)" stroke="#4a9bb8" strokeWidth="2"/>
        {/* Ear highlights */}
        <ellipse cx="5" cy="64" rx="7" ry="11" fill="#ffffff" opacity="0.3"/>
        <ellipse cx="135" cy="64" rx="7" ry="11" fill="#ffffff" opacity="0.3"/>
      </g>

      {/* Shield - positioned to overlap with robot */}
      <g transform="translate(10, 95)">
        {/* Shield shape */}
        <path d="M55 5 L100 22 L100 72 Q77 108 55 108 Q33 108 10 72 L10 22 Z"
              fill="url(#shieldGradient)" stroke="#2d6a82" strokeWidth="3"/>
        {/* Shield inner border */}
        <path d="M55 15 L90 28 L90 65 Q72 95 55 95 Q38 95 20 65 L20 28 Z"
              fill="none" stroke="#2d6a82" strokeWidth="2" opacity="0.5"/>
        {/* Bug icon on shield */}
        <ellipse cx="55" cy="58" rx="20" ry="25" fill="none" stroke="#1a4a5e" strokeWidth="2.5"/>
        <circle cx="55" cy="46" r="12" fill="none" stroke="#1a4a5e" strokeWidth="2.5"/>
        {/* Bug legs */}
        <line x1="35" y1="52" x2="23" y2="43" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="75" y1="52" x2="87" y2="43" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="32" y1="66" x2="20" y2="66" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="78" y1="66" x2="90" y2="66" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="35" y1="80" x2="25" y2="90" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="75" y1="80" x2="85" y2="90" stroke="#1a4a5e" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Bug center line */}
        <line x1="55" y1="34" x2="55" y2="83" stroke="#1a4a5e" strokeWidth="2" strokeLinecap="round"/>
      </g>

      {/* Highlights/Reflections on head */}
      <ellipse cx="175" cy="40" rx="18" ry="12" fill="#ffffff" opacity="0.4"/>
    </svg>
  )
}

export default function HomePage({ onGetStarted, onScanContract, onStartAudit }: HomePageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('quickscan')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum')
  const [contractAddress, setContractAddress] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
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
    } catch (err: any) {
      if (err.name === 'AbortError') return
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
      setContractInfo(null)
      setFetchedSource(null)
      setError(null)
      return
    }

    if (!isValidAddressFormat(address)) {
      setValidationStatus('idle')
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

  const handleStartScan = async () => {
    if (!contractAddress || validationStatus !== 'valid') return

    setIsStarting(true)
    setError(null)

    try {
      const response = await fetch('/scan/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: contractAddress,
          network: selectedNetwork,
          scanMode: 'quick',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start scan')
      }

      if (onStartAudit) {
        onStartAudit({
          project: data.projectName,
          branch: 'main',
          jobId: data.job.id,
        })
      } else {
        onScanContract()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start scan')
      setIsStarting(false)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

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
          <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logo} alt="Uatu Logo" className="h-10" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-20">
        {/* Row 1: Hero Text (Left) + Robot Mascot (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          {/* Left Side - Text Content */}
          <div className="py-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-[#0F3F62] leading-tight mb-8">
              Secure Your Smart {" "}
              Contracts with
              <span className="text-[#0F3F62] ml-2">AI-Driven Audits</span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 max-w-xl leading-relaxed">
              Leverage our advanced engine to safeguard your Web3 assets with rigorous vulnerability analysis.
            </p>
          </div>

          {/* Right Side - Robot Mascot */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Subtle glow effect behind robot */}
            <div className="absolute w-[400px] h-[400px] bg-[#0F3F62]/5 rounded-full blur-3xl" />

            {/* Robot with integrated Shield */}
            <div className="relative w-[360px] h-auto">
              <RobotMascot />
            </div>
          </div>
        </div>

        {/* Row 2: Centered Action Card */}
        <div className="flex justify-center">
          <div className="bg-white border -mt-10 border-gray-200 rounded-2xl p-6 backdrop-blur-sm w-full max-w-3xl shadow-xl shadow-gray-200/50">
              {/* Tabs */}
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => { setActiveTab('github'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'github'
                      ? 'bg-white text-[#0F3F62] shadow-md'
                      : 'text-gray-500 hover:text-[#0F3F62]'
                  }`}
                >
                  <GithubIcon className="w-5 h-5" />
                  Connect GitHub
                </button>
                <button
                  onClick={() => setActiveTab('quickscan')}
                  className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'quickscan'
                      ? 'bg-white text-[#0F3F62] shadow-md'
                      : 'text-gray-500 hover:text-[#0F3F62]'
                  }`}
                >
                  Quick Scan
                </button>
              </div>

              {activeTab === 'github' ? (
                /* GitHub Tab Content */
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-6">Connect your GitHub repository to audit your smart contracts</p>
                  <button
                    onClick={onGetStarted}
                    className="relative group inline-flex"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62] to-[#1a5a8a] rounded-xl blur-md group-hover:blur-lg transition-all opacity-30" />
                    <div className="relative bg-[#0F3F62] hover:bg-[#1a5a8a] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-3">
                      <GithubIcon className="w-5 h-5" />
                      Authorize GitHub Access
                    </div>
                  </button>
                </div>
              ) : (
                /* Quick Scan Tab Content */
                <div>
                  {/* Chain Selector Pills */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {networks.map((network) => (
                      <button
                        key={network.id}
                        onClick={() => handleNetworkChange(network.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedNetwork === network.id
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-600 hover:text-gray-800 border border-transparent hover:border-gray-300'
                        }`}
                        style={selectedNetwork === network.id ? { backgroundColor: network.color } : {}}
                      >
                        <span className="font-semibold">{network.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Contract Address Input */}
                  <div className="mb-5">
                    <div className="relative">
                      <input
                        type="text"
                        value={contractAddress}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        placeholder="0x1234... paste your contract address"
                        className={`w-full bg-gray-50 border rounded-lg px-4 py-4 text-gray-800 placeholder-gray-400 focus:outline-none transition-colors font-mono pr-12 ${
                          validationStatus === 'valid'
                            ? 'border-green-500 focus:border-green-400'
                            : validationStatus === 'invalid' || validationStatus === 'error'
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-gray-300 focus:border-[#0F3F62]'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {validationStatus === 'validating' && (
                          <Loader2 className="w-5 h-5 text-[#0F3F62] animate-spin" />
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
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium text-sm">{contractInfo.contractName}</span>
                            {fetchedSource.cached && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Cached</span>
                            )}
                          </div>
                          {contractInfo.explorerUrl && (
                            <a
                              href={contractInfo.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0F3F62] hover:underline flex items-center gap-1 text-xs"
                            >
                              Explorer <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-gray-500 text-xs">
                          <FileCode className="w-3 h-3" />
                          <span>{fetchedSource.fileCount} files</span>
                          {contractInfo.isProxy && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle className="w-3 h-3" />
                              Proxy
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {error && (
                      <p className="text-red-500 text-sm mt-2">{error}</p>
                    )}
                  </div>

                  {/* Start Scan Button */}
                  <button
                    onClick={handleStartScan}
                    disabled={validationStatus !== 'valid' || isStarting}
                    className={`w-full relative group ${
                      validationStatus !== 'valid' || isStarting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62] to-[#1a5a8a] rounded-xl blur-md group-hover:blur-lg transition-all opacity-30" />
                    <div className="relative bg-gradient-to-r from-[#0F3F62] to-[#1a5a8a] hover:from-[#1a5a8a] hover:to-[#0F3F62] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2">
                      {isStarting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Starting Scan...
                        </>
                      ) : (
                        <>
                          Start Quick Scan
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </div>
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
