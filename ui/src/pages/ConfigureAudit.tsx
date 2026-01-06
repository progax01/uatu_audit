import { useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import FileSelector from '../components/FileSelector'
// logo import removed per feedback

import { ProjectData } from '../App'

interface ConfigureAuditProps {
  onNext: () => void
  onBack: () => void
  projectData: ProjectData
  setProjectData: (data: any) => void
}

type EcosystemType = 'foundry' | 'hardhat' | 'anchor' | 'soroban' | 'node'
type TestStyle = 'behavioral' | 'stride' | 'owasp'

export default function ConfigureAudit({ onNext, onBack, projectData, setProjectData }: ConfigureAuditProps) {
  const [selectedEcosystems, setSelectedEcosystems] = useState<Set<EcosystemType>>(
    new Set(projectData.ecosystems as EcosystemType[] || [])
  )
  const [selectedTestStyles, setSelectedTestStyles] = useState<Set<TestStyle>>(
    new Set(projectData.testStyles as TestStyle[] || ['behavioral', 'stride'])
  )
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
    new Set(projectData.selectedFiles || [])
  )

  // Extract repo full name from URL
  const getRepoFullName = () => {
    const mainRepo = projectData.components.find(c => c.type === 'github-repo')
    return mainRepo?.config?.fullName || ''
  }

  const getBranch = () => {
    const mainRepo = projectData.components.find(c => c.type === 'github-repo')
    return mainRepo?.config?.currentBranch || 'main'
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
    setProjectData({
      ...projectData,
      ecosystems: Array.from(selectedEcosystems),
      testStyles: Array.from(selectedTestStyles),
      selectedFiles: Array.from(selectedFiles),
    })
    onNext()
  }

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
          <span className="text-indigo-600">03 Configuration</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Step Progress Indicator */}
        <div className="flex gap-4 mb-16">
          {/* Step 1 - Completed */}
          <div className="flex-1">
            <div className="border border-green-200 bg-green-50 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-green-600 font-semibold text-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                Step 1: Connect Source
              </div>
            </div>
          </div>

          {/* Step 2 - Active */}
          <div className="flex-1">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/10 to-[#0F3F62]/5 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative border-2 border-[#0F3F62] bg-white backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg shadow-[#0F3F62]/10">
                <div className="text-[#0F3F62] font-semibold text-lg">Step 2: Configure Audit</div>
              </div>
            </div>
          </div>

          {/* Step 3 - Inactive */}
          <div className="flex-1">
            <div className="border border-gray-200 bg-gray-50 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-gray-400 font-semibold text-lg">Step 3: Review & Run</div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/5 via-[#0F3F62]/3 to-[#0F3F62]/5 rounded-2xl blur-xl" />

          <div className="relative border border-gray-200 bg-white backdrop-blur-xl rounded-2xl p-12 shadow-xl">
            {/* Main Heading */}
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
              Audit Configuration
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">
              Phase 03: Specifying execution parameters
            </p>

            {/* Project Info Summary */}
            <div className="mb-10 p-6 bg-slate-50/50 rounded-2xl border border-black/[0.03]">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project</p>
                  <p className="text-slate-900 font-black">{projectData.name}</p>
                </div>
                <div className="w-px h-8 bg-black/[0.05]" />
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sources</p>
                  <p className="text-slate-900 font-bold">{projectData.components.length} Active Nodes</p>
                </div>
              </div>
            </div>

            {/* File Selection - Only show if there's a GitHub repo */}
            {getRepoFullName() && (
              <div className="mb-10">
                <FileSelector
                  repoFullName={getRepoFullName()}
                  branch={getBranch()}
                  selectedFiles={selectedFiles}
                  onSelectionChange={setSelectedFiles}
                />
              </div>
            )}

            {/* Type / Language Selection */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-[#0F3F62] mb-6">Select Ecosystem / Language</h2>
              <div className="grid grid-cols-2 gap-4">
                {ecosystems.map((eco) => (
                  <button
                    key={eco.id}
                    onClick={() => toggleEcosystem(eco.id)}
                    className={`
                      relative p-6 rounded-xl border-2 transition-all text-left
                      ${selectedEcosystems.has(eco.id)
                        ? 'border-[#0F3F62] bg-[#0F3F62]/5 shadow-lg shadow-[#0F3F62]/10'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-[#0F3F62] font-semibold text-lg">{eco.label}</h3>
                      {selectedEcosystems.has(eco.id) && (
                        <Check className="w-6 h-6 text-[#0F3F62]" />
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{eco.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Strategy Selection */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-[#0F3F62] mb-6">Test Generation Strategy</h2>
              <div className="grid grid-cols-2 gap-4">
                {testStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => toggleTestStyle(style.id)}
                    className={`
                      relative p-6 rounded-xl border-2 transition-all text-left
                      ${selectedTestStyles.has(style.id)
                        ? 'border-[#0F3F62] bg-[#0F3F62]/5 shadow-lg shadow-[#0F3F62]/10'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-[#0F3F62] font-semibold text-lg">{style.label}</h3>
                      {selectedTestStyles.has(style.id) && (
                        <Check className="w-6 h-6 text-[#0F3F62]" />
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">{style.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-600 hover:text-[#0F3F62] hover:border-[#0F3F62] transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>

              <button
                onClick={handleNext}
                className="relative px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30 hover:shadow-[#0F3F62]/50"
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
