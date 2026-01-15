import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Github,
  FileCode,
  Globe,
  Package,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Wallet,
  Link2
} from 'lucide-react'
import { getStoredUser, authFetch, type AuthUser } from '../services/authService'
import type { SourceComponentUI } from '../App'

type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit'
type ComponentType = 'github-repo' | 'deployed-contract' | 'dapp-url' | 'library-source' | 'manual-upload'

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

interface AddComponentsProps {
  projectId: string
  projectName: string
  projectType: ProjectType
  onNext: (components: SourceComponentUI[]) => void
  onBack: () => void
  onStartAudit: (jobId: number) => void
}

const COMPONENT_TYPES = [
  { type: 'github-repo' as ComponentType, label: 'GitHub', icon: Github, description: 'Import your repository from GitHub' },
  { type: 'deployed-contract' as ComponentType, label: 'Contract', icon: FileCode, description: 'Connect via network and address' },
  { type: 'dapp-url' as ComponentType, label: 'DApp', icon: Globe, description: 'Scan a live decentralized application', comingSoon: true },
  { type: 'library-source' as ComponentType, label: 'Dependencies', icon: Package, description: 'Check for known vulnerabilities in packages' },
]

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1, explorer: 'https://etherscan.io' },
  { id: 'arbitrum', name: 'Arbitrum One', chainId: 42161, explorer: 'https://arbiscan.io' },
  { id: 'polygon', name: 'Polygon', chainId: 137, explorer: 'https://polygonscan.com' },
  { id: 'base', name: 'Base', chainId: 8453, explorer: 'https://basescan.org' },
  { id: 'optimism', name: 'Optimism', chainId: 10, explorer: 'https://optimistic.etherscan.io' },
  { id: 'bsc', name: 'BNB Chain', chainId: 56, explorer: 'https://bscscan.com' },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114, explorer: 'https://snowtrace.io' },
]

export default function AddComponents({
  projectId: propProjectId,
  projectName: propProjectName,
  projectType: propProjectType,
  onNext,
  onBack,
  onStartAudit
}: AddComponentsProps) {
  // Read from localStorage if props are empty (after page reload)
  const getStoredProject = () => {
    try {
      const stored = localStorage.getItem('pending_project')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  const storedProject = getStoredProject()
  const projectId = propProjectId || storedProject?.id || ''
  const projectName = propProjectName || storedProject?.name || ''
  const _projectType = propProjectType || storedProject?.type || 'full' // Used for future component type filtering

  const [components, setComponents] = useState<SourceComponentUI[]>([])
  const [addingType, setAddingType] = useState<ComponentType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingAudit, setIsStartingAudit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  // GitHub form state
  const [isGithubAuthed, setIsGithubAuthed] = useState(false)
  const [githubPat, setGithubPat] = useState<string | null>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)

  // Helper to get GitHub headers (with PAT if available)
  const getGitHubHeaders = (): HeadersInit => {
    const headers: HeadersInit = {}
    const pat = localStorage.getItem('github_pat')
    if (pat) {
      headers['X-GitHub-Token'] = pat
    }
    return headers
  }

  // Contract form state
  const [contractAddress, setContractAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')

  // DApp form state
  const [dappUrl, setDappUrl] = useState('')
  const [dappName, setDappName] = useState('')
  const [checkContractInteractions, setCheckContractInteractions] = useState(true)
  const [checkFrontendVulns, setCheckFrontendVulns] = useState(true)

  // Library form state
  const [packageName, setPackageName] = useState('')
  const [packageVersion, setPackageVersion] = useState('')
  const [packageRegistry, setPackageRegistry] = useState<'npm' | 'crates' | 'pypi' | 'github'>('npm')

  // Redirect if no project ID available
  useEffect(() => {
    if (!projectId) {
      console.error('No project ID available - redirecting to create project')
      window.location.href = '/create-project'
    }
  }, [projectId])

  // Load current user and check GitHub auth on mount
  useEffect(() => {
    const user = getStoredUser()
    setCurrentUser(user)
    checkGithubAuth()
  }, [])

  const checkGithubAuth = async () => {
    // First check for stored PAT
    const storedPat = localStorage.getItem('github_pat')
    if (storedPat) {
      setGithubPat(storedPat)
      setIsGithubAuthed(true)
      fetchRepositories()
      return
    }

    // Fall back to OAuth check
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
      const res = await fetch('/github/repos', { headers: getGitHubHeaders() })
      const data = await res.json()
      if (Array.isArray(data)) {
        setRepositories(data)
      } else {
        console.error('Failed to fetch repos:', data?.error)
        setRepositories([])
      }
    } catch {
      console.error('Failed to fetch repos')
    } finally {
      setLoadingRepos(false)
    }
  }

  const fetchBranches = async (repoFullName: string) => {
    try {
      const res = await fetch(`/github/branches?repo=${encodeURIComponent(repoFullName)}`, {
        headers: getGitHubHeaders()
      })
      const data = await res.json()
      setBranches(data)
    } catch {
      console.error('Failed to fetch branches')
    }
  }

  const handleGithubLogin = () => {
    localStorage.setItem('oauth_return_url', window.location.pathname + window.location.search)
    window.location.href = '/auth/github/login'
  }

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repo = repositories.find(r => r.full_name === e.target.value)
    if (repo) {
      setSelectedRepo(repo)
      setSelectedBranch('')
      fetchBranches(repo.full_name)
    }
  }

  const addGithubComponent = async () => {
    if (!selectedRepo || !selectedBranch) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await authFetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'github-repo',
          displayName: selectedRepo.full_name,
          config: {
            owner: selectedRepo.full_name.split('/')[0],
            repo: selectedRepo.full_name.split('/')[1],
            fullName: selectedRepo.full_name,
            cloneUrl: selectedRepo.clone_url,
            defaultBranch: selectedRepo.default_branch,
            trackedBranches: [selectedBranch],
            currentBranch: selectedBranch,
            isPrivate: selectedRepo.private
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add component')

      const component = await res.json()
      setComponents(prev => [...prev, {
        id: component.id,
        type: 'github-repo',
        displayName: selectedRepo.full_name,
        status: 'pending',
        config: component.config
      }])
      resetForms()
      setAddingType(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const addContractComponent = async () => {
    if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid contract address')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const network = NETWORKS.find(n => n.id === selectedNetwork)
      const res = await authFetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deployed-contract',
          displayName: `${contractAddress.slice(0, 10)}... on ${network?.name}`,
          config: {
            address: contractAddress,
            network: selectedNetwork,
            chainId: network?.chainId,
            isVerified: false,
            isProxy: false,
            sourceCached: false,
            explorerUrl: `${network?.explorer || 'https://etherscan.io'}/address/${contractAddress}`
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add component')

      const component = await res.json()
      setComponents(prev => [...prev, {
        id: component.id,
        type: 'deployed-contract',
        displayName: component.displayName,
        status: 'pending',
        config: component.config
      }])
      resetForms()
      setAddingType(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const addDappComponent = async () => {
    if (!dappUrl || !dappUrl.startsWith('http')) {
      setError('Invalid URL')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dapp-url',
          displayName: dappName || new URL(dappUrl).hostname,
          config: {
            url: dappUrl,
            name: dappName || new URL(dappUrl).hostname,
            checkContractInteractions,
            checkFrontendVulnerabilities: checkFrontendVulns,
            checkApiEndpoints: true,
            crawlDepth: 3
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add component')

      const component = await res.json()
      setComponents(prev => [...prev, {
        id: component.id,
        type: 'dapp-url',
        displayName: component.displayName,
        status: 'pending',
        config: component.config
      }])
      resetForms()
      setAddingType(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const addLibraryComponent = async () => {
    if (!packageName) {
      setError('Package name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'library-source',
          displayName: `${packageName}${packageVersion ? `@${packageVersion}` : ''}`,
          config: {
            packageName,
            version: packageVersion || 'latest',
            registry: packageRegistry,
            usedBy: []
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add component')

      const component = await res.json()
      setComponents(prev => [...prev, {
        id: component.id,
        type: 'library-source',
        displayName: component.displayName,
        status: 'pending',
        config: component.config
      }])
      resetForms()
      setAddingType(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const removeComponent = async (componentId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/components/${componentId}`, {
        method: 'DELETE'
      })
      setComponents(prev => prev.filter(c => c.id !== componentId))
    } catch {
      console.error('Failed to remove component')
    }
  }

  const resetForms = () => {
    setSelectedRepo(null)
    setSelectedBranch('')
    setBranches([])
    setContractAddress('')
    setSelectedNetwork('ethereum')
    setDappUrl('')
    setDappName('')
    setPackageName('')
    setPackageVersion('')
    setError(null)
  }

  const handleStartAudit = async () => {
    if (components.length === 0) {
      setError('Add at least one source to start audit')
      return
    }

    setIsStartingAudit(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!res.ok) throw new Error('Failed to start audit')

      const data = await res.json()
      // Clear pending project from localStorage
      localStorage.removeItem('pending_project')
      onStartAudit(data.jobId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsStartingAudit(false)
    }
  }

  // No longer needed: return Github etc.

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Breadcrumbs */}
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
          <span className="text-indigo-600">02 Sources</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-slate-300">03 Configuration</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-slate-300">04 Run</span>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Source Selection */}
        <div className="lg:col-span-7">
          <header className="mb-12">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
              {projectName}: Connect Sources
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Select codebases or contracts for analysis
            </p>
          </header>

          {!addingType ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMPONENT_TYPES.map((ct) => {
                const Icon = ct.icon
                const isDisabled = ct.comingSoon
                return (
                  <button
                    key={ct.type}
                    onClick={() => !isDisabled && setAddingType(ct.type)}
                    disabled={isDisabled}
                    className={`relative flex flex-col items-start gap-6 p-8 rounded-3xl border border-black/[0.03] bg-white/50 backdrop-blur-sm transition-all group text-left ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/10'
                    }`}
                  >
                    {isDisabled && (
                      <div className="absolute top-4 right-4 px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-400 uppercase">
                        Soon
                      </div>
                    )}
                    <div className={`w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center transition-all duration-500 ${
                      !isDisabled ? 'group-hover:bg-indigo-600 group-hover:text-white' : ''
                    }`}>
                      <Icon size={28} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{ct.label}</h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {ct.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-black/[0.03] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-600">
                    {(() => {
                      const Icon = COMPONENT_TYPES.find(ct => ct.type === addingType)?.icon || Github
                      return <Icon size={20} />
                    })()}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Add {COMPONENT_TYPES.find(ct => ct.type === addingType)?.label}
                  </h3>
                </div>
                <button
                  onClick={() => { setAddingType(null); resetForms() }}
                  className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-6">
                {addingType === 'github-repo' && (
                  <div className="space-y-6">
                    {!isGithubAuthed ? (
                      <div className="text-center py-8">
                        {/* Show current auth status for wallet users */}
                        {currentUser?.walletAddress && !currentUser?.githubLogin && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full mb-6">
                            <Wallet size={14} className="text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                              Signed in with Wallet
                            </span>
                          </div>
                        )}

                        <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-6">
                          <div className="relative">
                            <Github size={32} className="text-slate-300" />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Link2 size={10} className="text-white" />
                            </div>
                          </div>
                        </div>

                        <h4 className="text-xl font-black text-slate-900 mb-2">Connect GitHub Account</h4>
                        <p className="text-sm text-slate-500 mb-2 max-w-sm mx-auto">
                          Link your GitHub to import private repositories for auditing.
                        </p>
                        {currentUser?.walletAddress && (
                          <p className="text-[11px] text-slate-400 mb-8">
                            Your wallet authentication remains active. GitHub is an additional connection.
                          </p>
                        )}
                        {!currentUser?.walletAddress && (
                          <p className="text-[11px] text-slate-400 mb-8">
                            This grants read access to your repositories for security analysis.
                          </p>
                        )}

                        <button
                          onClick={handleGithubLogin}
                          className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20"
                        >
                          <Github size={18} />
                          Connect GitHub
                        </button>

                        <p className="text-[10px] text-slate-400 mt-6">
                          We only request read permissions. Your code stays secure.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Repository</label>
                            <div className="flex gap-2">
                              <select
                                value={selectedRepo?.full_name || ''}
                                onChange={handleRepoChange}
                                className="flex-1 bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 focus:ring-0 transition-all appearance-none"
                              >
                                <option value="">Browse repositories...</option>
                                {repositories.map(repo => (
                                  <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                                ))}
                              </select>
                              <button
                                onClick={fetchRepositories}
                                disabled={loadingRepos}
                                className="px-5 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"
                              >
                                <RefreshCw size={20} className={`${loadingRepos ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Branch</label>
                            <select
                              value={selectedBranch}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              disabled={!selectedRepo}
                              className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 focus:ring-0 transition-all appearance-none disabled:opacity-50"
                            >
                              <option value="">Select branch...</option>
                              {branches.map(branch => (
                                <option key={branch.name} value={branch.name}>{branch.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={addGithubComponent}
                          disabled={!selectedRepo || !selectedBranch || isLoading}
                          className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition-all shadow-xl shadow-indigo-500/20"
                        >
                          {isLoading ? 'Syncing...' : 'Add Repository'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {addingType === 'deployed-contract' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Network</label>
                        <select
                          value={selectedNetwork}
                          onChange={(e) => setSelectedNetwork(e.target.value)}
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        >
                          {NETWORKS.map(net => (
                            <option key={net.id} value={net.id}>{net.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Contract Address</label>
                        <input
                          type="text"
                          value={contractAddress}
                          onChange={(e) => setContractAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        />
                      </div>
                    </div>
                    <button
                      onClick={addContractComponent}
                      disabled={!contractAddress || isLoading}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                    >
                      Connect Contract
                    </button>
                  </div>
                )}

                {addingType === 'dapp-url' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">DApp URL</label>
                        <input
                          type="url"
                          value={dappUrl}
                          onChange={(e) => setDappUrl(e.target.value)}
                          placeholder="https://app.example.com"
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Name (optional)</label>
                        <input
                          type="text"
                          value={dappName}
                          onChange={(e) => setDappName(e.target.value)}
                          placeholder="My DApp"
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkContractInteractions}
                          onChange={(e) => setCheckContractInteractions(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <span className="text-sm text-slate-700 font-medium">Check contract interactions</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkFrontendVulns}
                          onChange={(e) => setCheckFrontendVulns(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <span className="text-sm text-slate-700 font-medium">Check frontend vulnerabilities</span>
                      </label>
                    </div>
                    <button
                      onClick={addDappComponent}
                      disabled={!dappUrl || isLoading}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                    >
                      Add DApp
                    </button>
                  </div>
                )}

                {addingType === 'library-source' && (
                  <div className="space-y-6">
                    {/* Info banner */}
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-xs text-amber-700 font-medium">
                        <span className="font-black">Quick Scan:</span> We'll search for known CVEs, security advisories, and announced vulnerabilities for this package.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Package Name</label>
                        <input
                          type="text"
                          value={packageName}
                          onChange={(e) => setPackageName(e.target.value)}
                          placeholder="@openzeppelin/contracts"
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Version <span className="text-slate-300 font-medium lowercase">(optional)</span></label>
                        <input
                          type="text"
                          value={packageVersion}
                          onChange={(e) => setPackageVersion(e.target.value)}
                          placeholder="4.9.0"
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Registry</label>
                        <select
                          value={packageRegistry}
                          onChange={(e) => setPackageRegistry(e.target.value as any)}
                          className="w-full bg-slate-50 border border-transparent rounded-2xl px-5 py-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 transition-all"
                        >
                          <option value="npm">npm</option>
                          <option value="crates">crates.io</option>
                          <option value="pypi">PyPI</option>
                          <option value="github">GitHub</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={addLibraryComponent}
                      disabled={!packageName || isLoading}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition-all"
                    >
                      Check for Vulnerabilities
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Active Nodes / Components List */}
        <div className="lg:col-span-5">
          <div className="sticky top-12 space-y-8">
            <header>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Active Nodes</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {components.length} components ready for analysis
              </p>
            </header>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              {components.map((component) => {
                const Icon = COMPONENT_TYPES.find(ct => ct.type === component.type)?.icon || FileCode
                return (
                  <div
                    key={component.id}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-black/[0.03] bg-white group hover:border-indigo-100 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{component.displayName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {component.type.replace('-', ' ')}
                      </p>
                    </div>
                    <button
                      onClick={() => removeComponent(component.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )
              })}

              {components.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <Plus size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">No components added yet</p>
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-black/[0.03] space-y-4">
              <button
                onClick={() => {
                  // Clear pending project from localStorage
                  localStorage.removeItem('pending_project')
                  onNext(components)
                }}
                disabled={components.length === 0 || isStartingAudit}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition-all shadow-xl"
              >
                Proceed to Configuration
              </button>

              {components.length > 0 && (
                <button
                  onClick={handleStartAudit}
                  disabled={isStartingAudit}
                  className="w-full py-4 bg-white text-emerald-600 border-2 border-emerald-100 rounded-2xl font-black text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  {isStartingAudit ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Express Analyze & Run
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
