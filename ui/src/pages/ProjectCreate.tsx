import { useState } from 'react'
import { ArrowLeft, Shield, FileCode, Globe, BookOpen, ChevronRight } from 'lucide-react'
import logo from '../assets/logo.svg'

type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit'

interface ProjectCreateProps {
  onNext: (project: { id: string; name: string; description?: string; type: ProjectType }) => void
  onBack: () => void
  onHomeClick: () => void
}

const PROJECT_TYPES = [
  {
    type: 'full' as ProjectType,
    title: 'Full Audit',
    description: 'Complete security audit including smart contracts, frontend, and backend code',
    icon: Shield,
    recommended: true
  },
  {
    type: 'contract-only' as ProjectType,
    title: 'Contracts Only',
    description: 'Focus on smart contract security analysis (Solidity, Rust, etc.)',
    icon: FileCode,
    recommended: false
  },
  {
    type: 'dapp-pentest' as ProjectType,
    title: 'DApp Pentest',
    description: 'Web application security testing with contract interaction analysis',
    icon: Globe,
    recommended: false
  },
  {
    type: 'library-audit' as ProjectType,
    title: 'Library Audit',
    description: 'Audit open-source libraries and dependencies',
    icon: BookOpen,
    recommended: false
  }
]

export default function ProjectCreate({ onNext, onBack, onHomeClick }: ProjectCreateProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState<ProjectType>('full')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length >= 3

  const handleSubmit = async () => {
    if (!isValid) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: selectedType,
          settings: {
            testStyles: ['behavioral', 'stride'],
            aiEnabled: true,
            auditDepth: 'standard'
          }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const project = await res.json()
      onNext({
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type
      })
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

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
          <button
            onClick={onHomeClick}
            className="flex items-center hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0"
          >
            <img src={logo} alt="Uatu Logo" className="h-10" />
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-[#0F3F62] transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/5 via-[#0F3F62]/3 to-[#0F3F62]/5 rounded-2xl blur-xl" />

          <div className="relative border border-gray-200 bg-white backdrop-blur-xl rounded-2xl p-10 shadow-xl">
            <h1 className="text-4xl font-bold text-[#0F3F62] mb-2">
              Create New Project
            </h1>
            <p className="text-gray-500 mb-10">
              Set up a new security audit project with multiple sources
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Project Name */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-[#0F3F62] mb-3">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My DeFi Protocol"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20 transition-all text-lg"
              />
              {name.length > 0 && name.length < 3 && (
                <p className="mt-2 text-sm text-amber-600">
                  Name must be at least 3 characters
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-[#0F3F62] mb-3">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project..."
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20 transition-all resize-none"
              />
            </div>

            {/* Project Type Selection */}
            <div className="mb-10">
              <label className="block text-lg font-semibold text-[#0F3F62] mb-4">
                Project Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                {PROJECT_TYPES.map((pt) => {
                  const Icon = pt.icon
                  const isSelected = selectedType === pt.type
                  return (
                    <button
                      key={pt.type}
                      onClick={() => setSelectedType(pt.type)}
                      className={`
                        relative flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left
                        ${isSelected
                          ? 'border-[#0F3F62] bg-[#0F3F62]/5 shadow-lg shadow-[#0F3F62]/10'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {pt.recommended && (
                        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                      <div className={`
                        w-12 h-12 rounded-lg flex items-center justify-center mb-3
                        ${isSelected ? 'bg-[#0F3F62] text-white' : 'bg-gray-100 text-gray-600'}
                      `}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className={`font-bold mb-1 ${isSelected ? 'text-[#0F3F62]' : 'text-gray-800'}`}>
                        {pt.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {pt.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Continue Button */}
            <div className="flex items-center justify-end pt-6 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={!isValid || isLoading}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200
                  ${isValid && !isLoading
                    ? 'bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30 hover:shadow-[#0F3F62]/50'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue: Add Sources
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
