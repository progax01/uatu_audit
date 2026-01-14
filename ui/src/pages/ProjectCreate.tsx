import { useState, useEffect } from 'react'
import { ArrowLeft, Shield, FileCode, Globe, BookOpen, ChevronRight, Check, Github, ExternalLink, RefreshCw, FolderGit, Layers, Wallet, Link2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { authFetch, getStoredUser, type AuthUser } from '../services/authService'

type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit'
type SourceMode = 'github' | 'deployed'
type RepoStructure = 'monorepo' | 'multirepo'

interface Repository {
  id: number
  full_name: string
  default_branch: string
  clone_url: string
  private: boolean
}

interface Branch {
  name: string
  protected: boolean
}

interface ProjectCreateProps {
  onNext: (project: { id: string; name: string; description?: string; type: ProjectType }) => void
  onBack: () => void
  onHomeClick: () => void
}

const PROJECT_TYPES = [
  {
    type: 'contract-only' as ProjectType,
    title: 'Smart Contracts',
    description: 'Solidity, Rust, Move - security analysis for on-chain code',
    icon: FileCode,
    recommended: true
  },
  {
    type: 'full' as ProjectType,
    title: 'Full Stack',
    description: 'Complete audit including contracts, frontend, and backend',
    icon: Shield,
    recommended: false
  },
  {
    type: 'dapp-pentest' as ProjectType,
    title: 'DApp Pentest',
    description: 'Web application security with contract interaction analysis',
    icon: Globe,
    recommended: false,
    comingSoon: true
  },
  {
    type: 'library-audit' as ProjectType,
    title: 'Library Audit',
    description: 'Audit open-source libraries and dependencies',
    icon: BookOpen,
    recommended: false,
    comingSoon: true
  }
]

export default function ProjectCreate({ onNext, onBack }: ProjectCreateProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState<ProjectType>('contract-only')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 3: Source connection state
  const [sourceMode, setSourceMode] = useState<SourceMode>('github')
  const [repoStructure, setRepoStructure] = useState<RepoStructure>('monorepo')

  // GitHub state
  const [isGithubAuthed, setIsGithubAuthed] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  // Multi-repo state (for full audit)
  const [contractsRepo, setContractsRepo] = useState<Repository | null>(null)
  const [contractsBranch, setContractsBranch] = useState('')
  const [frontendRepo, setFrontendRepo] = useState<Repository | null>(null)
  const [frontendBranch, setFrontendBranch] = useState('')
  const [backendRepo, setBackendRepo] = useState<Repository | null>(null)
  const [backendBranch, setBackendBranch] = useState('')

  // Deployed contract state
  const [contractAddress, setContractAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')

  const NETWORKS = [
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'arbitrum', name: 'Arbitrum' },
    { id: 'base', name: 'Base' },
    { id: 'polygon', name: 'Polygon' },
    { id: 'optimism', name: 'Optimism' },
    { id: 'bsc', name: 'BNB Chain' },
  ]

  const isStep1Valid = name.trim().length >= 3

  const isStep3Valid = () => {
    if (sourceMode === 'deployed') {
      return contractAddress.match(/^0x[a-fA-F0-9]{40}$/)
    }
    if (selectedType === 'full' && repoStructure === 'multirepo') {
      return contractsRepo && contractsBranch // At minimum, contracts repo required
    }
    return selectedRepo && selectedBranch
  }

  // Check GitHub auth and load user on mount
  useEffect(() => {
    const user = getStoredUser()
    setCurrentUser(user)
    checkGithubAuth()
  }, [])

  const checkGithubAuth = async () => {
    try {
      const res = await fetch('/auth/github/me')
      const data = await res.json()
      if (data.authed) {
        setIsGithubAuthed(true)
        fetchRepositories()
      }
    } catch {
      setIsGithubAuthed(false)
    }
  }

  const fetchRepositories = async () => {
    setLoadingRepos(true)
    try {
      const res = await fetch('/github/repos')
      const data = await res.json()
      setRepositories(data)
    } catch {
      console.error('Failed to fetch repos')
    } finally {
      setLoadingRepos(false)
    }
  }

  const fetchBranches = async (repoFullName: string): Promise<Branch[]> => {
    try {
      const res = await fetch(`/github/branches?repo=${encodeURIComponent(repoFullName)}`)
      return await res.json()
    } catch {
      return []
    }
  }

  const handleGithubLogin = () => {
    localStorage.setItem('oauth_return_url', window.location.pathname)
    window.location.href = '/auth/github/login'
  }

  const handleRepoSelect = async (repo: Repository, setter: (r: Repository | null) => void, branchSetter: (b: string) => void) => {
    setter(repo)
    branchSetter('')
    const branchList = await fetchBranches(repo.full_name)
    setBranches(branchList)
    if (branchList.length > 0) {
      const defaultBranch = branchList.find(b => b.name === repo.default_branch) || branchList[0]
      branchSetter(defaultBranch.name)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Build components array based on selections
      const components: any[] = []

      if (sourceMode === 'deployed') {
        components.push({
          type: 'deployed-contract',
          displayName: `${contractAddress.slice(0, 10)}... on ${NETWORKS.find(n => n.id === selectedNetwork)?.name}`,
          config: {
            address: contractAddress,
            network: selectedNetwork
          }
        })
      } else if (selectedType === 'full' && repoStructure === 'multirepo') {
        if (contractsRepo) {
          components.push({
            type: 'github-repo',
            displayName: contractsRepo.full_name,
            config: {
              owner: contractsRepo.full_name.split('/')[0],
              repo: contractsRepo.full_name.split('/')[1],
              fullName: contractsRepo.full_name,
              cloneUrl: contractsRepo.clone_url,
              currentBranch: contractsBranch,
              role: 'contracts'
            }
          })
        }
        if (frontendRepo) {
          components.push({
            type: 'github-repo',
            displayName: frontendRepo.full_name,
            config: {
              owner: frontendRepo.full_name.split('/')[0],
              repo: frontendRepo.full_name.split('/')[1],
              fullName: frontendRepo.full_name,
              cloneUrl: frontendRepo.clone_url,
              currentBranch: frontendBranch,
              role: 'frontend'
            }
          })
        }
        if (backendRepo) {
          components.push({
            type: 'github-repo',
            displayName: backendRepo.full_name,
            config: {
              owner: backendRepo.full_name.split('/')[0],
              repo: backendRepo.full_name.split('/')[1],
              fullName: backendRepo.clone_url,
              cloneUrl: backendRepo.clone_url,
              currentBranch: backendBranch,
              role: 'backend'
            }
          })
        }
      } else if (selectedRepo) {
        components.push({
          type: 'github-repo',
          displayName: selectedRepo.full_name,
          config: {
            owner: selectedRepo.full_name.split('/')[0],
            repo: selectedRepo.full_name.split('/')[1],
            fullName: selectedRepo.full_name,
            cloneUrl: selectedRepo.clone_url,
            currentBranch: selectedBranch,
            role: repoStructure === 'monorepo' ? 'monorepo' : 'contracts'
          }
        })
      }

      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: selectedType,
          components,
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

  const renderStepIndicator = () => (
    <nav className="flex items-center gap-3 mb-10">
      <button
        onClick={step === 1 ? onBack : () => setStep((step - 1) as 1 | 2)}
        className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
        <button
          onClick={() => step > 1 && setStep(1)}
          className={`transition-colors ${step === 1 ? 'text-indigo-600' : step > 1 ? 'text-emerald-500 hover:text-emerald-600 cursor-pointer' : 'text-slate-300'}`}
        >
          01 Identity
        </button>
        <ChevronRight size={12} className="text-slate-200" />
        <button
          onClick={() => step > 2 && setStep(2)}
          className={`transition-colors ${step === 2 ? 'text-indigo-600' : step > 2 ? 'text-emerald-500 hover:text-emerald-600 cursor-pointer' : 'text-slate-300'}`}
        >
          02 Strategy
        </button>
        <ChevronRight size={12} className="text-slate-200" />
        <span className={step === 3 ? 'text-indigo-600' : 'text-slate-300'}>03 Sources</span>
      </div>
    </nav>
  )

  const renderRepoSelector = (
    label: string,
    repo: Repository | null,
    branch: string,
    onRepoChange: (r: Repository | null) => void,
    onBranchChange: (b: string) => void,
    optional: boolean = false
  ) => (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {label} {optional && <span className="text-slate-300 font-medium lowercase">(optional)</span>}
      </label>
      <div className="flex gap-3">
        <select
          value={repo?.full_name || ''}
          onChange={(e) => {
            const r = repositories.find(r => r.full_name === e.target.value)
            if (r) handleRepoSelect(r, onRepoChange, onBranchChange)
            else {
              onRepoChange(null)
              onBranchChange('')
            }
          }}
          className="flex-1 bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all"
        >
          <option value="">Select repository...</option>
          {repositories.map(r => (
            <option key={r.id} value={r.full_name}>{r.full_name}</option>
          ))}
        </select>
        {repo && (
          <select
            value={branch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="w-40 bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all"
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {renderStepIndicator()}

      <div className="relative">
        <AnimatePresence mode="wait">
          {/* Step 1: Identity */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Project Identity
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Name your security audit project
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. DeFi Protocol V2"
                    className="w-full bg-slate-50 border border-black/[0.03] rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Description <span className="text-slate-300 font-medium lowercase">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the project scope..."
                    rows={3}
                    className="w-full bg-slate-50 border border-black/[0.03] rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-black/[0.03]">
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className={`btn-primary px-8 py-3 ${!isStep1Valid ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  Continue
                  <ChevronRight size={14} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Strategy */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Audit Type
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  What would you like to audit?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {PROJECT_TYPES.map((pt) => {
                  const Icon = pt.icon
                  const isSelected = selectedType === pt.type
                  const isDisabled = pt.comingSoon
                  return (
                    <button
                      key={pt.type}
                      onClick={() => !isDisabled && setSelectedType(pt.type)}
                      disabled={isDisabled}
                      className={`
                        relative group p-5 rounded-2xl border-2 transition-all text-left
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isSelected && !isDisabled
                          ? 'bg-indigo-50/50 border-indigo-200'
                          : 'bg-white border-black/[0.03] hover:border-slate-200'
                        }
                      `}
                    >
                      {pt.recommended && !isDisabled && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[8px] font-black text-emerald-600 uppercase">
                          <Check size={8} strokeWidth={3} />
                          Popular
                        </div>
                      )}
                      {isDisabled && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-400 uppercase">
                          Soon
                        </div>
                      )}

                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all
                        ${isSelected && !isDisabled ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}
                      `}>
                        <Icon size={20} strokeWidth={2} />
                      </div>

                      <h3 className={`text-sm font-black mb-1 ${isSelected && !isDisabled ? 'text-indigo-900' : 'text-slate-900'}`}>
                        {pt.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        {pt.description}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-end pt-6 border-t border-black/[0.03]">
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary px-8 py-3"
                >
                  Connect Sources
                  <ChevronRight size={14} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Connect Sources */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Connect Sources
                </h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {selectedType === 'contract-only' ? 'Link your smart contracts' : 'Connect your codebase'}
                </p>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600">
                  {error}
                </div>
              )}

              {/* Source Type Selector (for contracts only) */}
              {selectedType === 'contract-only' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setSourceMode('github')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      sourceMode === 'github'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-black/[0.03] text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <Github size={18} />
                    <span className="text-xs font-black uppercase tracking-wider">GitHub Repository</span>
                  </button>
                  <button
                    onClick={() => setSourceMode('deployed')}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      sourceMode === 'deployed'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-black/[0.03] text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <ExternalLink size={18} />
                    <span className="text-xs font-black uppercase tracking-wider">Deployed Contract</span>
                  </button>
                </div>
              )}

              {/* GitHub Source */}
              {sourceMode === 'github' && (
                <div className="space-y-6">
                  {!isGithubAuthed ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-black/[0.03]">
                      {/* Show wallet badge for wallet users */}
                      {currentUser?.walletAddress && !currentUser?.githubLogin && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full mb-5">
                          <Wallet size={14} className="text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                            Signed in with Wallet
                          </span>
                        </div>
                      )}

                      <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center mx-auto mb-5 shadow-sm">
                        <div className="relative">
                          <Github size={28} className="text-slate-300" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                            <Link2 size={8} className="text-white" />
                          </div>
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mb-2">Connect GitHub Account</h4>
                      <p className="text-xs text-slate-400 mb-1 max-w-xs mx-auto">
                        Link your GitHub to import repositories for auditing.
                      </p>
                      {currentUser?.walletAddress && (
                        <p className="text-[10px] text-slate-400 mb-5">
                          Your wallet auth remains active. GitHub is additional.
                        </p>
                      )}
                      {!currentUser?.walletAddress && (
                        <p className="text-[10px] text-slate-400 mb-5">
                          We only request read access to analyze your code.
                        </p>
                      )}

                      <button
                        onClick={handleGithubLogin}
                        className="inline-flex items-center gap-2.5 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition-all shadow-lg"
                      >
                        <Github size={16} />
                        Connect GitHub
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-black/[0.03] p-8">
                      {/* Header */}
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                          <Github size={28} className="text-emerald-600" />
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1">GitHub Connected</h4>
                        <p className="text-xs text-slate-400">
                          Select a repository to audit
                        </p>
                      </div>

                      {/* Repo Structure for Full Audit */}
                      {selectedType === 'full' && (
                        <div className="space-y-3 mb-6">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Project Structure
                          </label>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setRepoStructure('monorepo')}
                              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                repoStructure === 'monorepo'
                                  ? 'bg-indigo-50 border-indigo-200'
                                  : 'bg-slate-50 border-transparent hover:border-slate-200'
                              }`}
                            >
                              <FolderGit size={18} className={repoStructure === 'monorepo' ? 'text-indigo-600' : 'text-slate-400'} />
                              <div className="text-left">
                                <span className={`text-xs font-black block ${repoStructure === 'monorepo' ? 'text-indigo-900' : 'text-slate-900'}`}>Monorepo</span>
                                <span className="text-[10px] text-slate-400">All code in one repository</span>
                              </div>
                            </button>
                            <button
                              onClick={() => setRepoStructure('multirepo')}
                              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                repoStructure === 'multirepo'
                                  ? 'bg-indigo-50 border-indigo-200'
                                  : 'bg-slate-50 border-transparent hover:border-slate-200'
                              }`}
                            >
                              <Layers size={18} className={repoStructure === 'multirepo' ? 'text-indigo-600' : 'text-slate-400'} />
                              <div className="text-left">
                                <span className={`text-xs font-black block ${repoStructure === 'multirepo' ? 'text-indigo-900' : 'text-slate-900'}`}>Multiple Repos</span>
                                <span className="text-[10px] text-slate-400">Separate repos per component</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Single repo selector (monorepo or contracts-only) */}
                      {(selectedType === 'contract-only' || repoStructure === 'monorepo') && (
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {selectedType === 'full' ? 'Monorepo' : 'Repository'}
                              </label>
                              <button
                                onClick={fetchRepositories}
                                disabled={loadingRepos}
                                className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                              >
                                <RefreshCw size={12} className={loadingRepos ? 'animate-spin' : ''} />
                                Refresh
                              </button>
                            </div>
                            <select
                              value={selectedRepo?.full_name || ''}
                              onChange={(e) => {
                                const r = repositories.find(r => r.full_name === e.target.value)
                                if (r) handleRepoSelect(r, setSelectedRepo, setSelectedBranch)
                              }}
                              className="w-full bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3.5 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all"
                            >
                              <option value="">Select repository...</option>
                              {repositories.map(r => (
                                <option key={r.id} value={r.full_name}>{r.full_name}</option>
                              ))}
                            </select>
                          </div>
                          {selectedRepo && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Branch
                              </label>
                              <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3.5 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all"
                              >
                                {branches.map(b => (
                                  <option key={b.name} value={b.name}>{b.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Multi-repo selectors */}
                      {selectedType === 'full' && repoStructure === 'multirepo' && (
                        <div className="space-y-5">
                          {renderRepoSelector('Contracts Repository', contractsRepo, contractsBranch, setContractsRepo, setContractsBranch, false)}
                          {renderRepoSelector('Frontend Repository', frontendRepo, frontendBranch, setFrontendRepo, setFrontendBranch, true)}
                          {renderRepoSelector('Backend Repository', backendRepo, backendBranch, setBackendRepo, setBackendBranch, true)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Deployed Contract Source */}
              {sourceMode === 'deployed' && (
                <div className="bg-white rounded-2xl border border-black/[0.03] p-8">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                      <ExternalLink size={28} className="text-slate-400" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mb-1">Import from Blockchain</h4>
                    <p className="text-xs text-slate-400">
                      We'll fetch verified source code from the block explorer
                    </p>
                  </div>

                  {/* Form */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Network
                      </label>
                      <select
                        value={selectedNetwork}
                        onChange={(e) => setSelectedNetwork(e.target.value)}
                        className="w-full bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3.5 text-sm text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all"
                      >
                        {NETWORKS.map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Contract Address
                      </label>
                      <input
                        type="text"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-slate-50 border border-black/[0.03] rounded-xl px-4 py-3.5 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-black/[0.03]">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !isStep3Valid()}
                  className={`btn-primary px-10 py-3 ${isLoading || !isStep3Valid() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : (
                    <>
                      Create Project
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
