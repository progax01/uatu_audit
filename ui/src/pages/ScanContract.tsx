import { useState } from 'react'
import { ArrowRight, Home } from 'lucide-react'
import logo from '../assets/icon_audits.png'

interface ScanContractProps {
  onBack: () => void
  onHomeClick: () => void
}

type ScanMode = 'quick' | 'full'
type Network = 'arbitrum' | 'ethereum' | 'polygon' | 'base' | 'bnb' | 'optimism'

const networks: { id: Network; name: string; shortName: string; color: string }[] = [
  { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', color: '#28A0F0' },
  { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', shortName: 'POLY', color: '#8247E5' },
  { id: 'base', name: 'Base', shortName: 'BASE', color: '#0052FF' },
  { id: 'bnb', name: 'BNB Chain', shortName: 'BNB', color: '#F3BA2F' },
  { id: 'optimism', name: 'Optimism', shortName: 'OP', color: '#FF0420' },
]

export default function ScanContract({ onBack, onHomeClick }: ScanContractProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('quick')
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('arbitrum')
  const [contractAddress, setContractAddress] = useState('')

  const handleStartScan = () => {
    if (!contractAddress) {
      alert('Please enter a contract address')
      return
    }
    alert(`Starting ${scanMode} scan on ${selectedNetwork} for contract: ${contractAddress}`)
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
          {/* <button
            onClick={onHomeClick}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button> */}
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
                  onClick={() => setSelectedNetwork(network.id)}
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
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x1234... paste your contract"
              className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00ffff] transition-colors font-mono"
            />
            <p className="text-gray-500 text-sm mt-2">
              We run an AI surface scan on the verified source code from the selected chain's explorer.
            </p>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleStartScan}
            className="w-full relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/30 to-[#00e6e6]/30 rounded-xl blur-md group-hover:blur-lg transition-all" />
            <div className="relative bg-gradient-to-r from-[#00ffff]/20 to-[#00e6e6]/20 hover:from-[#00ffff]/30 hover:to-[#00e6e6]/30 border border-[#00ffff]/50 text-[#00ffff] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2">
              Start {scanMode === 'quick' ? 'Quick Scan' : 'Full Audit'}
              <ArrowRight className="w-5 h-5" />
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
