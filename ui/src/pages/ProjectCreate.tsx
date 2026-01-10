import { useState } from 'react'
import { ArrowLeft, Shield, FileCode, Globe, BookOpen, ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { authFetch } from '../services/authService'

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

export default function ProjectCreate({ onNext, onBack }: ProjectCreateProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState<ProjectType>('full')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isStep1Valid = name.trim().length >= 3

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await authFetch('/api/projects', {
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
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumbs / Step Indicator */}
      <nav className="flex items-center gap-3 mb-12">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
          <span className={step === 1 ? 'text-indigo-600' : 'text-slate-300'}>01 Identity</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className={step === 2 ? 'text-indigo-600' : 'text-slate-300'}>02 Strategy</span>
        </div>
      </nav>

      <div className="relative">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                  Project Identity
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Phase 01: Defining logical boundaries
                </p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                    Project Codename <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sovereign Protocol Alpha"
                    className="w-full bg-slate-50 border border-black/[0.03] rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300"
                  />
                  {name.length > 0 && name.length < 3 && (
                    <p className="text-[10px] font-bold text-rose-500 pl-1 uppercase tracking-wider">
                      Codename too short (min 3 chars)
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                    Mission Briefing <span className="text-slate-300 font-bold lowercase tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the technical scope and security objectives..."
                    rows={4}
                    className="w-full bg-slate-50 border border-black/[0.03] rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-black/[0.02]">
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className={`btn-primary px-10 py-3 ${!isStep1Valid ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                >
                  Define Audit Strategy
                  <ChevronRight size={14} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <div>
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] mb-4"
                >
                  <ArrowLeft size={12} />
                  Change Identity
                </button>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                  Audit Strategy
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Phase 02: Selection of analysis vectors
                </p>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-black text-rose-600 uppercase tracking-widest">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROJECT_TYPES.map((pt) => {
                  const Icon = pt.icon
                  const isSelected = selectedType === pt.type
                  return (
                    <button
                      key={pt.type}
                      onClick={() => setSelectedType(pt.type)}
                      className={`
                        relative group p-6 rounded-[24px] border-2 transition-all text-left
                        ${isSelected
                          ? 'bg-indigo-50/50 border-indigo-200 shadow-lg shadow-indigo-500/5'
                          : 'bg-white border-black/[0.03] hover:border-slate-200 hover:bg-slate-50/50'
                        }
                      `}
                    >
                      {pt.recommended && (
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100/50 rounded-lg text-[8px] font-black text-emerald-600 uppercase tracking-widest">
                          <Check size={10} strokeWidth={3} />
                          Recommended
                        </div>
                      )}

                      <div className={`
                        w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500
                        ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-slate-50 text-slate-400 group-hover:text-slate-600 group-hover:bg-white'}
                      `}>
                        <Icon size={24} strokeWidth={2} />
                      </div>

                      <h3 className={`text-base font-black tracking-tight mb-1 ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                        {pt.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold leading-relaxed opacity-80">
                        {pt.description}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-end pt-6 border-t border-black/[0.02]">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`btn-primary px-12 py-3 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Provisioning...
                    </div>
                  ) : (
                    <>
                      Initialize Deployment
                      <ChevronRight size={14} strokeWidth={3} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

