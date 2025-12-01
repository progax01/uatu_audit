import { useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import logo from '../assets/icon_audits.png'
import FileSelector from '../components/FileSelector'

interface ConfigureAuditProps {
  onNext: () => void
  onBack: () => void
  onHomeClick: () => void
  repoData: {
    repo: string
    branch: string
    project: string
  }
  setRepoData: (data: any) => void
}

type EcosystemType = 'foundry' | 'hardhat' | 'anchor' | 'soroban' | 'node'
type TestStyle = 'behavioral' | 'stride' | 'owasp'

export default function ConfigureAudit({ onNext, onBack, onHomeClick, repoData, setRepoData }: ConfigureAuditProps) {
  const [selectedEcosystems, setSelectedEcosystems] = useState<Set<EcosystemType>>(new Set())
  const [selectedTestStyles, setSelectedTestStyles] = useState<Set<TestStyle>>(
    new Set(['behavioral', 'stride'])
  )
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Extract repo full name from URL (e.g., "https://github.com/owner/repo.git" -> "owner/repo")
  const getRepoFullName = () => {
    const match = repoData.repo.match(/github\.com[/:]([^/]+\/[^/.]+)/i)
    return match ? match[1] : ''
  }

  const ecosystems = [
    { id: 'foundry' as const, label: 'Foundry', description: 'Solidity/Foundry' },
    { id: 'hardhat' as const, label: 'Hardhat', description: 'Solidity/Hardhat' },
    { id: 'anchor' as const, label: 'Anchor', description: 'Solana/Anchor' },
    { id: 'soroban' as const, label: 'Soroban', description: 'Stellar/Soroban' },
    { id: 'node' as const, label: 'Node.js', description: 'Node.js/JavaScript' },
  ]

  const testStyles = [
    {
      id: 'behavioral' as const,
      label: 'Behavioral (H/N/S/N)',
      description: 'Happy path, Negative, Security, Network tests',
    },
    {
      id: 'stride' as const,
      label: 'STRIDE Threats',
      description: 'Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation',
    },
    {
      id: 'owasp' as const,
      label: 'OWASP SC Top 10',
      description: 'Access Control, Reentrancy, Overflow, DoS, Randomness, Front-running, Time Manipulation',
    },
  ]

  const toggleEcosystem = (id: EcosystemType) => {
    const newSet = new Set(selectedEcosystems)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedEcosystems(newSet)
  }

  const toggleTestStyle = (id: TestStyle) => {
    const newSet = new Set(selectedTestStyles)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedTestStyles(newSet)
  }

  const handleNext = () => {
    const data = {
      ...repoData,
      ecosystems: Array.from(selectedEcosystems),
      testStyles: Array.from(selectedTestStyles),
      selectedFiles: Array.from(selectedFiles),
    }
    setRepoData(data)
    onNext()
  }

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
          <button
            onClick={onHomeClick}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0"
          >
            <img src={logo} alt="UatuAudit Logo" className="w-12 h-12" />
            <span className="text-2xl font-bold text-white tracking-tight">UatuAudit</span>
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Step Progress Indicator */}
        <div className="flex gap-4 mb-16">
          {/* Step 1 - Completed */}
          <div className="flex-1">
            <div className="border border-green-500/50 bg-[#0a0f1f]/60 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-green-400 font-semibold text-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                Step 1: Connect Source
              </div>
            </div>
          </div>

          {/* Step 2 - Active */}
          <div className="flex-1">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/20 to-[#00ffff]/10 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative border-2 border-[#00ffff] bg-[#0a0f1f]/80 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg shadow-[#00ffff]/20">
                <div className="text-[#00ffff] font-semibold text-lg">Step 2: Configure Audit</div>
              </div>
            </div>
          </div>

          {/* Step 3 - Inactive */}
          <div className="flex-1">
            <div className="border border-gray-700/50 bg-[#1a1f2e]/50 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-gray-500 font-semibold text-lg">Step 3: Review & Run</div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/10 via-[#0099ff]/5 to-[#00ffff]/10 rounded-2xl blur-xl" />

          <div className="relative border border-[#00ffff]/30 bg-[#0d1426]/90 backdrop-blur-xl rounded-2xl p-12 shadow-2xl">
            {/* Main Heading */}
            <h1 className="text-5xl font-bold text-white mb-12 tracking-tight">
              Configure Audit Parameters
            </h1>

            {/* Project Info Summary */}
            <div className="mb-10 p-6 bg-[#0a0f1f]/60 rounded-xl border border-[#00ffff]/20">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Project</p>
                  <p className="text-white font-semibold text-lg">{repoData.project}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-2">Branch</p>
                  <p className="text-white font-semibold text-lg">{repoData.branch}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-2">Repository</p>
                  <p className="text-white font-semibold text-lg truncate" title={repoData.repo}>
                    {repoData.repo.split('/').slice(-1)[0].replace('.git', '')}
                  </p>
                </div>
              </div>
            </div>

            {/* File Selection */}
            <div className="mb-10">
              <FileSelector
                repoFullName={getRepoFullName()}
                branch={repoData.branch}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
              />
            </div>

            {/* Type / Language Selection */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-6">Select Ecosystem / Language</h2>
              <div className="grid grid-cols-2 gap-4">
                {ecosystems.map((eco) => (
                  <button
                    key={eco.id}
                    onClick={() => toggleEcosystem(eco.id)}
                    className={`
                      relative p-6 rounded-xl border-2 transition-all text-left
                      ${selectedEcosystems.has(eco.id)
                        ? 'border-[#00ffff] bg-[#00ffff]/10 shadow-lg shadow-[#00ffff]/20'
                        : 'border-gray-700/50 bg-[#0a0f1f]/40 hover:border-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-semibold text-lg">{eco.label}</h3>
                      {selectedEcosystems.has(eco.id) && (
                        <Check className="w-6 h-6 text-[#00ffff]" />
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{eco.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Strategy Selection */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-6">Test Generation Strategy</h2>
              <div className="grid grid-cols-2 gap-4">
                {testStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => toggleTestStyle(style.id)}
                    className={`
                      relative p-6 rounded-xl border-2 transition-all text-left
                      ${selectedTestStyles.has(style.id)
                        ? 'border-[#00ffff] bg-[#00ffff]/10 shadow-lg shadow-[#00ffff]/20'
                        : 'border-gray-700/50 bg-[#0a0f1f]/40 hover:border-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-semibold text-lg">{style.label}</h3>
                      {selectedTestStyles.has(style.id) && (
                        <Check className="w-6 h-6 text-[#00ffff]" />
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{style.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-700/30">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>

              <button
                onClick={handleNext}
                className="relative px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 bg-[#00ffff] text-[#0a0f1f] hover:bg-[#00e6e6] shadow-lg shadow-[#00ffff]/30 hover:shadow-[#00ffff]/50"
              >
                Next: Review & Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
