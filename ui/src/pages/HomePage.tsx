import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowRight, Loader2, CheckCircle, XCircle, ExternalLink, FileCode, AlertTriangle } from 'lucide-react'
import logo from '../assets/icon_audits.png'

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

const networks: { id: Network; name: string; icon: string; color: string }[] = [
  { id: 'arbitrum', name: 'Arbitrum', icon: '/chains/arbitrum.svg', color: '#28A0F0' },
  { id: 'ethereum', name: 'Ethereum', icon: '/chains/ethereum.svg', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', icon: '/chains/polygon.svg', color: '#8247E5' },
  { id: 'bnb', name: 'BNB', icon: '/chains/bnb.svg', color: '#F3BA2F' },
  { id: 'optimism', name: 'Optimism', icon: '/chains/optimism.svg', color: '#FF0420' },
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

// Robot Mascot SVG Component
function RobotMascot() {
  return (
    <svg viewBox="0 0 200 220" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Robot Head */}
      <ellipse cx="100" cy="70" rx="55" ry="50" fill="#1a2744" stroke="#00ffff" strokeWidth="2"/>

      {/* Helmet/Visor */}
      <path d="M50 70 Q50 30 100 30 Q150 30 150 70 Q150 90 100 90 Q50 90 50 70" fill="#0d1426" stroke="#00ffff" strokeWidth="2"/>

      {/* Face Screen */}
      <ellipse cx="100" cy="65" rx="35" ry="25" fill="#0a0f1f"/>

      {/* Eyes - Uatu Symbol */}
      <path d="M85 60 Q100 50 115 60" stroke="#00ffff" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M85 70 Q100 80 115 70" stroke="#00ffff" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* Antenna */}
      <line x1="100" y1="20" x2="100" y2="5" stroke="#00ffff" strokeWidth="2"/>
      <circle cx="100" cy="5" r="4" fill="#00ffff"/>

      {/* Headphones */}
      <ellipse cx="45" cy="70" rx="12" ry="18" fill="#1a2744" stroke="#3b5998" strokeWidth="2"/>
      <ellipse cx="155" cy="70" rx="12" ry="18" fill="#1a2744" stroke="#3b5998" strokeWidth="2"/>

      {/* Body */}
      <path d="M60 120 L60 170 Q60 190 80 190 L120 190 Q140 190 140 170 L140 120 Q140 100 100 100 Q60 100 60 120" fill="#1a2744" stroke="#00ffff" strokeWidth="2"/>

      {/* Shield on body */}
      <path d="M80 130 L100 125 L120 130 L120 155 Q100 170 80 155 Z" fill="#0d1426" stroke="#00ffff" strokeWidth="2"/>

      {/* Bug icon on shield */}
      <circle cx="100" cy="145" r="8" stroke="#00ffff" strokeWidth="1.5" fill="none"/>
      <line x1="100" y1="137" x2="100" y2="153" stroke="#00ffff" strokeWidth="1.5"/>
      <line x1="92" y1="142" x2="108" y2="142" stroke="#00ffff" strokeWidth="1.5"/>
      <line x1="92" y1="148" x2="108" y2="148" stroke="#00ffff" strokeWidth="1.5"/>

      {/* Arms */}
      <ellipse cx="45" cy="140" rx="12" ry="25" fill="#1a2744" stroke="#3b5998" strokeWidth="2"/>
      <ellipse cx="155" cy="140" rx="12" ry="25" fill="#1a2744" stroke="#3b5998" strokeWidth="2"/>

      {/* Jetpack flames */}
      <path d="M75 190 Q70 210 75 220 Q80 210 75 190" fill="#00ffff" opacity="0.6"/>
      <path d="M100 190 Q95 215 100 225 Q105 215 100 190" fill="#00ffff" opacity="0.8"/>
      <path d="M125 190 Q130 210 125 220 Q120 210 125 190" fill="#00ffff" opacity="0.6"/>
    </svg>
  )
}

// Shield with Bug Icon
function ShieldIcon() {
  return (
    <svg viewBox="0 0 80 100" className="w-20 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 5 L75 20 L75 55 Q75 85 40 95 Q5 85 5 55 L5 20 Z" fill="#0d1426" stroke="#00ffff" strokeWidth="2"/>
      <circle cx="40" cy="50" r="18" stroke="#00ffff" strokeWidth="2" fill="none"/>
      <line x1="40" y1="32" x2="40" y2="68" stroke="#00ffff" strokeWidth="2"/>
      <line x1="22" y1="45" x2="58" y2="45" stroke="#00ffff" strokeWidth="2"/>
      <line x1="22" y1="55" x2="58" y2="55" stroke="#00ffff" strokeWidth="2"/>
      {/* Bug legs */}
      <line x1="28" y1="38" x2="22" y2="32" stroke="#00ffff" strokeWidth="1.5"/>
      <line x1="52" y1="38" x2="58" y2="32" stroke="#00ffff" strokeWidth="1.5"/>
      <line x1="28" y1="62" x2="22" y2="68" stroke="#00ffff" strokeWidth="1.5"/>
      <line x1="52" y1="62" x2="58" y2="68" stroke="#00ffff" strokeWidth="1.5"/>
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

      {/* Header */}
      <header className="relative z-10 border-b border-[#00ffff]/20 bg-[#0a0f1f]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logo} alt="UatuAudit Logo" className="w-12 h-12" />
            <span className="text-2xl font-bold text-white tracking-tight">UatuAudit</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text Content */}
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Secure Your Smart
              <br />
              Contracts with
              <br />
              <span className="text-[#00ffff]">AI-Driven Audits</span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-lg">
              Leverage our advanced engine to safeguard your Web3 assets with rigorous vulnerability analysis.
            </p>

            {/* Main Action Card */}
            <div className="bg-[#0d1426]/90 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm max-w-xl">
              {/* Tabs */}
              <div className="flex mb-6 bg-[#1a1f2e] rounded-lg p-1">
                <button
                  onClick={() => { setActiveTab('github'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'github'
                      ? 'bg-[#0d1426] text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <GithubIcon className="w-5 h-5" />
                  Connect GitHub
                </button>
                <button
                  onClick={() => setActiveTab('quickscan')}
                  className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'quickscan'
                      ? 'bg-[#0d1426] text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Quick Scan
                </button>
              </div>

              {activeTab === 'github' ? (
                /* GitHub Tab Content */
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-6">Connect your GitHub repository to audit your smart contracts</p>
                  <button
                    onClick={onGetStarted}
                    className="relative group inline-flex"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff] to-[#00e6e6] rounded-xl blur-md group-hover:blur-lg transition-all opacity-50" />
                    <div className="relative bg-[#00ffff] hover:bg-[#00e6e6] text-[#0a0f1f] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-3">
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
                            : 'bg-[#1a1f2e] text-gray-400 hover:text-white border border-transparent hover:border-gray-700'
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
                        className={`w-full bg-[#1a1f2e] border rounded-lg px-4 py-4 text-white placeholder-gray-500 focus:outline-none transition-colors font-mono pr-12 ${
                          validationStatus === 'valid'
                            ? 'border-green-500 focus:border-green-400'
                            : validationStatus === 'invalid' || validationStatus === 'error'
                            ? 'border-red-500 focus:border-red-400'
                            : 'border-gray-700 focus:border-[#00ffff]'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
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
                      <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-green-400 font-medium text-sm">{contractInfo.contractName}</span>
                            {fetchedSource.cached && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Cached</span>
                            )}
                          </div>
                          {contractInfo.explorerUrl && (
                            <a
                              href={contractInfo.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00ffff] hover:underline flex items-center gap-1 text-xs"
                            >
                              Explorer <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-gray-400 text-xs">
                          <FileCode className="w-3 h-3" />
                          <span>{fetchedSource.fileCount} files</span>
                          {contractInfo.isProxy && (
                            <span className="flex items-center gap-1 text-yellow-400">
                              <AlertTriangle className="w-3 h-3" />
                              Proxy
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {error && (
                      <p className="text-red-400 text-sm mt-2">{error}</p>
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
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff] to-[#00e6e6] rounded-xl blur-md group-hover:blur-lg transition-all opacity-50" />
                    <div className="relative bg-gradient-to-r from-[#00ffff] to-[#00e6e6] hover:from-[#00e6e6] hover:to-[#00ffff] text-[#0a0f1f] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2">
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

          {/* Right Side - Robot Mascot */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Glow effect behind robot */}
            <div className="absolute w-80 h-80 bg-[#00ffff]/10 rounded-full blur-3xl" />

            {/* Robot and Shield */}
            <div className="relative flex items-center gap-4">
              {/* Shield */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 z-10">
                <ShieldIcon />
              </div>

              {/* Robot */}
              <div className="w-72 h-80">
                <RobotMascot />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
