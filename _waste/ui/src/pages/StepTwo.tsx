import { useState } from 'react'

interface StepTwoProps {
  onNext: () => void
  onBack: () => void
  repoData: {
    repo: string
    branch: string
    project: string
  }
  setRepoData: (data: any) => void
}

type EcosystemType = 'foundry' | 'hardhat' | 'anchor' | 'soroban' | 'node'
type TestStyle = 'behavioral' | 'stride'

export default function StepTwo({ onNext, onBack, repoData, setRepoData }: StepTwoProps) {
  const [selectedEcosystems, setSelectedEcosystems] = useState<Set<EcosystemType>>(new Set())
  const [selectedTestStyles, setSelectedTestStyles] = useState<Set<TestStyle>>(
    new Set(['behavioral', 'stride'])
  )

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
    // Store selections in repoData for Step 3
    const data = {
      ...repoData,
      ecosystems: Array.from(selectedEcosystems),
      testStyles: Array.from(selectedTestStyles),
    }
    setRepoData(data)
    onNext()
  }

  return (
    <div className="card max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-uatu-text mb-6">Configure Audit</h2>

      {/* Project Info Summary */}
      <div className="mb-6 p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-uatu-muted mb-1">Project</p>
            <p className="text-uatu-text font-medium">{repoData.project}</p>
          </div>
          <div>
            <p className="text-uatu-muted mb-1">Branch</p>
            <p className="text-uatu-text font-medium">{repoData.branch}</p>
          </div>
          <div>
            <p className="text-uatu-muted mb-1">Repository</p>
            <p className="text-uatu-text font-medium truncate" title={repoData.repo}>
              {repoData.repo.split('/').slice(-1)[0].replace('.git', '')}
            </p>
          </div>
        </div>
      </div>

      {/* Type / Language Selection */}
      <div className="mb-6">
        <h3 className="text-uatu-text font-semibold mb-3">Type / Language</h3>
        <p className="text-uatu-muted text-sm mb-4">
          Select the frameworks/ecosystems to audit. Leave empty for auto-detection.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ecosystems.map((ecosystem) => (
            <button
              key={ecosystem.id}
              onClick={() => toggleEcosystem(ecosystem.id)}
              className={`
                p-4 rounded-uatu-sm border-2 text-left transition-all
                ${
                  selectedEcosystems.has(ecosystem.id)
                    ? 'border-uatu-accent bg-uatu-accent bg-opacity-10'
                    : 'border-uatu-line bg-uatu-input hover:border-uatu-muted'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-uatu-text">{ecosystem.label}</span>
                <div
                  className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center
                    ${
                      selectedEcosystems.has(ecosystem.id)
                        ? 'border-uatu-accent bg-uatu-accent'
                        : 'border-uatu-line'
                    }
                  `}
                >
                  {selectedEcosystems.has(ecosystem.id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-uatu-muted text-xs">{ecosystem.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Test Styles */}
      <div className="mb-6">
        <h3 className="text-uatu-text font-semibold mb-3">Test Styles</h3>
        <p className="text-uatu-muted text-sm mb-4">
          Choose the testing methodologies to apply during the audit.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {testStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => toggleTestStyle(style.id)}
              className={`
                p-4 rounded-uatu-sm border-2 text-left transition-all
                ${
                  selectedTestStyles.has(style.id)
                    ? 'border-uatu-accent bg-uatu-accent bg-opacity-10'
                    : 'border-uatu-line bg-uatu-input hover:border-uatu-muted'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-uatu-text">{style.label}</span>
                <div
                  className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center
                    ${
                      selectedTestStyles.has(style.id)
                        ? 'border-uatu-accent bg-uatu-accent'
                        : 'border-uatu-line'
                    }
                  `}
                >
                  {selectedTestStyles.has(style.id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-uatu-muted text-xs">{style.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={selectedTestStyles.size === 0}
          className={`btn-primary ${selectedTestStyles.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next: Review & Run →
        </button>
      </div>
    </div>
  )
}
