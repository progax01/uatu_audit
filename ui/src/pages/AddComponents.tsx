import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Github,
  FileCode,
  Globe,
  Package,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Loader2
} from 'lucide-react'
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
  onHomeClick: () => void
  onStartAudit: (jobId: number) => void
}

const COMPONENT_TYPES = [
  { type: 'github-repo' as ComponentType, label: 'GitHub', icon: Github },
  { type: 'deployed-contract' as ComponentType, label: 'Contract', icon: FileCode },
  { type: 'dapp-url' as ComponentType, label: 'DApp', icon: Globe },
  { type: 'library-source' as ComponentType, label: 'Library', icon: Package },
]

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1 },
  { id: 'arbitrum', name: 'Arbitrum One', chainId: 42161 },
  { id: 'polygon', name: 'Polygon', chainId: 137 },
  { id: 'base', name: 'Base', chainId: 8453 },
  { id: 'optimism', name: 'Optimism', chainId: 10 },
  { id: 'bsc', name: 'BNB Chain', chainId: 56 },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114 },
]

export default function AddComponents({
  projectId,
  projectName,
  projectType: _projectType, // Used for future component type filtering
  onNext,
  onBack,
  onHomeClick,
  onStartAudit
}: AddComponentsProps) {
  const [components, setComponents] = useState<SourceComponentUI[]>([])
  const [addingType, setAddingType] = useState<ComponentType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingAudit, setIsStartingAudit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GitHub form state
  const [isGithubAuthed, setIsGithubAuthed] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)

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

  // Check GitHub auth on mount
  useEffect(() => {
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

  const fetchBranches = async (repoFullName: string) => {
    try {
      const res = await fetch(`/github/branches?repo=${encodeURIComponent(repoFullName)}`)
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
      const res = await fetch(`/api/projects/${projectId}/components`, {
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
      const res = await fetch(`/api/projects/${projectId}/components`, {
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
            explorerUrl: `https://etherscan.io/address/${contractAddress}`
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
      onStartAudit(data.jobId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsStartingAudit(false)
    }
  }

  const getComponentIcon = (type: ComponentType) => {
    switch (type) {
      case 'github-repo': return Github
      case 'deployed-contract': return FileCode
      case 'dapp-url': return Globe
      case 'library-source': return Package
      default: return Upload
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
            <img src="/logo.svg" alt="Uatu Logo" className="h-10" />
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-[#0F3F62] transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/5 via-[#0F3F62]/3 to-[#0F3F62]/5 rounded-2xl blur-xl" />

          <div className="relative border border-gray-200 bg-white backdrop-blur-xl rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-[#0F3F62] mb-1">
                  Add Sources to "{projectName}"
                </h1>
                <p className="text-gray-500">
                  Add repositories, contracts, and other sources for your audit
                </p>
              </div>
              <span className="text-sm font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                {components.length} source{components.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Component List */}
            {components.length > 0 && (
              <div className="mb-8 space-y-3">
                {components.map(comp => {
                  const Icon = getComponentIcon(comp.type)
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                          <Icon className="w-5 h-5 text-[#0F3F62]" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{comp.displayName}</h4>
                          <p className="text-sm text-gray-500 capitalize">{comp.type.replace('-', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${
                          comp.status === 'synced' ? 'text-green-600' :
                          comp.status === 'error' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {comp.status === 'synced' ? <CheckCircle className="w-4 h-4" /> :
                           comp.status === 'error' ? <AlertCircle className="w-4 h-4" /> :
                           <Loader2 className="w-4 h-4 animate-spin" />}
                          {comp.status}
                        </span>
                        <button
                          onClick={() => removeComponent(comp.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add Component Section */}
            {!addingType ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-[#0F3F62] mb-4">Add Source</h3>
                <div className="grid grid-cols-4 gap-4">
                  {COMPONENT_TYPES.map(ct => {
                    const Icon = ct.icon
                    return (
                      <button
                        key={ct.type}
                        onClick={() => setAddingType(ct.type)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:border-[#0F3F62] hover:bg-[#0F3F62]/5 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-[#0F3F62]/10 flex items-center justify-center transition-colors">
                          <Icon className="w-6 h-6 text-gray-600 group-hover:text-[#0F3F62]" />
                        </div>
                        <span className="font-medium text-gray-700 group-hover:text-[#0F3F62]">
                          {ct.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-[#0F3F62]">
                    Add {COMPONENT_TYPES.find(ct => ct.type === addingType)?.label}
                  </h3>
                  <button
                    onClick={() => { setAddingType(null); resetForms() }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* GitHub Form */}
                {addingType === 'github-repo' && (
                  <div className="space-y-4">
                    {!isGithubAuthed ? (
                      <button
                        onClick={handleGithubLogin}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                      >
                        <Github className="w-5 h-5" />
                        Connect GitHub Account
                      </button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
                            <div className="flex gap-2">
                              <select
                                value={selectedRepo?.full_name || ''}
                                onChange={handleRepoChange}
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                                disabled={loadingRepos}
                              >
                                <option value="">Select repository...</option>
                                {repositories.map(repo => (
                                  <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                                ))}
                              </select>
                              <button
                                onClick={fetchRepositories}
                                disabled={loadingRepos}
                                className="p-2.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg transition-all"
                              >
                                <RefreshCw className={`w-5 h-5 text-gray-600 ${loadingRepos ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                            <select
                              value={selectedBranch}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                              disabled={!selectedRepo}
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
                          className="w-full flex items-center justify-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] disabled:bg-gray-300 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                        >
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                          Add Repository
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Contract Form */}
                {addingType === 'deployed-contract' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contract Address</label>
                        <input
                          type="text"
                          value={contractAddress}
                          onChange={(e) => setContractAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 font-mono focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Network</label>
                        <select
                          value={selectedNetwork}
                          onChange={(e) => setSelectedNetwork(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        >
                          {NETWORKS.map(net => (
                            <option key={net.id} value={net.id}>{net.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={addContractComponent}
                      disabled={!contractAddress || isLoading}
                      className="w-full flex items-center justify-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] disabled:bg-gray-300 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Add Contract
                    </button>
                  </div>
                )}

                {/* DApp Form */}
                {addingType === 'dapp-url' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">DApp URL</label>
                        <input
                          type="url"
                          value={dappUrl}
                          onChange={(e) => setDappUrl(e.target.value)}
                          placeholder="https://app.example.com"
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name (optional)</label>
                        <input
                          type="text"
                          value={dappName}
                          onChange={(e) => setDappName(e.target.value)}
                          placeholder="My DApp"
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkContractInteractions}
                          onChange={(e) => setCheckContractInteractions(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#0F3F62] focus:ring-[#0F3F62]"
                        />
                        <span className="text-sm text-gray-700">Check contract interactions</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkFrontendVulns}
                          onChange={(e) => setCheckFrontendVulns(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#0F3F62] focus:ring-[#0F3F62]"
                        />
                        <span className="text-sm text-gray-700">Check frontend vulnerabilities</span>
                      </label>
                    </div>
                    <button
                      onClick={addDappComponent}
                      disabled={!dappUrl || isLoading}
                      className="w-full flex items-center justify-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] disabled:bg-gray-300 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Add DApp
                    </button>
                  </div>
                )}

                {/* Library Form */}
                {addingType === 'library-source' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Package Name</label>
                        <input
                          type="text"
                          value={packageName}
                          onChange={(e) => setPackageName(e.target.value)}
                          placeholder="@openzeppelin/contracts"
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Version (optional)</label>
                        <input
                          type="text"
                          value={packageVersion}
                          onChange={(e) => setPackageVersion(e.target.value)}
                          placeholder="4.9.0"
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Registry</label>
                        <select
                          value={packageRegistry}
                          onChange={(e) => setPackageRegistry(e.target.value as any)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20"
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
                      className="w-full flex items-center justify-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] disabled:bg-gray-300 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Add Library
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-200 mt-8">
              <button
                onClick={() => onNext(components)}
                className="text-gray-500 hover:text-[#0F3F62] font-medium transition-colors"
              >
                Configure Settings
              </button>
              <button
                onClick={handleStartAudit}
                disabled={components.length === 0 || isStartingAudit}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200
                  ${components.length > 0 && !isStartingAudit
                    ? 'bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30 hover:shadow-[#0F3F62]/50'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isStartingAudit ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Audit
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
