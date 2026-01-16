import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Github, FileCode, Globe, Package, Plus, X, Check, RefreshCw, Trash2 } from 'lucide-react'
import { authFetch } from '../../services/authService'

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

interface Component {
  id: string
  type: string
  displayName: string
  status?: string
  config: any
}

interface SourcesTabProps {
  projectId: string
  components: Component[]
  onComponentAdded: () => void
}

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1, explorer: 'https://etherscan.io' },
  { id: 'arbitrum', name: 'Arbitrum One', chainId: 42161, explorer: 'https://arbiscan.io' },
  { id: 'polygon', name: 'Polygon', chainId: 137, explorer: 'https://polygonscan.com' },
  { id: 'base', name: 'Base', chainId: 8453, explorer: 'https://basescan.org' },
  { id: 'optimism', name: 'Optimism', chainId: 10, explorer: 'https://optimistic.etherscan.io' },
  { id: 'bsc', name: 'BNB Chain', chainId: 56, explorer: 'https://bscscan.com' },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114, explorer: 'https://snowtrace.io' },
]

export default function SourcesTab({ projectId, components, onComponentAdded }: SourcesTabProps) {
  const [addingType, setAddingType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // GitHub state
  const [isGithubAuthed, setIsGithubAuthed] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)

  // Contract state
  const [contractAddress, setContractAddress] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum')

  const getGitHubHeaders = (): HeadersInit => {
    const headers: HeadersInit = {}
    const pat = localStorage.getItem('github_pat')
    if (pat) {
      headers['X-GitHub-Token'] = pat
    }
    return headers
  }

  useEffect(() => {
    checkGithubAuth()
  }, [])

  const checkGithubAuth = async () => {
    const storedPat = localStorage.getItem('github_pat')
    if (storedPat) {
      setIsGithubAuthed(true)
      return
    }

    try {
      const res = await fetch('/auth/github/me')
      const data = await res.json()
      if (data.authed) {
        setIsGithubAuthed(true)
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

  const handleAddGitHub = async () => {
    if (!selectedRepo || !selectedBranch) return

    setLoading(true)
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

      setAddingType(null)
      setSelectedRepo(null)
      setSelectedBranch('')
      onComponentAdded()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContract = async () => {
    if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid contract address')
      return
    }

    setLoading(true)
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
            explorerUrl: `${network?.explorer}/address/${contractAddress}`
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add component')

      setAddingType(null)
      setContractAddress('')
      onComponentAdded()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteComponent = async (componentId: string) => {
    setDeletingId(componentId)
    try {
      const res = await authFetch(`/api/projects/${projectId}/components/${componentId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete component')

      onComponentAdded() // Refresh the component list
    } catch (err: any) {
      console.error('Failed to delete component:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusLabel = (status?: string) => {
    if (!status || status === 'pending') return 'Ready'
    if (status === 'ready') return 'Ready'
    return status
  }

  const getStatusColor = (status?: string) => {
    if (!status || status === 'pending') return 'bg-emerald-50 text-emerald-600'
    if (status === 'ready') return 'bg-emerald-50 text-emerald-600'
    return 'bg-amber-50 text-amber-600'
  }

  return (
    <div className="space-y-6 relative">
      {/* GitHub Modal */}
      {addingType === 'github' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setAddingType(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg">Add GitHub Repository</h3>
              <button onClick={() => setAddingType(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {!isGithubAuthed ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-600 mb-4">Connect GitHub to import repositories</p>
                <button
                  onClick={() => window.location.href = '/auth/github/login'}
                  className="btn-primary px-6 py-3"
                >
                  <Github size={16} />
                  Connect GitHub
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Repository</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedRepo?.full_name || ''}
                      onChange={(e) => {
                        const repo = repositories.find(r => r.full_name === e.target.value)
                        if (repo) {
                          setSelectedRepo(repo)
                          setSelectedBranch('')
                          fetchBranches(repo.full_name)
                        }
                      }}
                      className="flex-1 h-11 px-4 bg-white border border-black/[0.05] rounded-xl text-sm"
                    >
                      <option value="">Select repository...</option>
                      {repositories.map(repo => (
                        <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                      ))}
                    </select>
                    <button
                      onClick={fetchRepositories}
                      disabled={loadingRepos}
                      className="px-4 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <RefreshCw size={16} className={loadingRepos ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {selectedRepo && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Branch</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-xl text-sm"
                    >
                      <option value="">Select branch...</option>
                      {branches.map(branch => (
                        <option key={branch.name} value={branch.name}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingType(null)}
                    className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddGitHub}
                    disabled={!selectedRepo || !selectedBranch || loading}
                    className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Repository'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Contract Modal */}
      {addingType === 'contract' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setAddingType(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg">Add Deployed Contract</h3>
              <button onClick={() => setAddingType(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Network</label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-xl text-sm"
              >
                {NETWORKS.map(network => (
                  <option key={network.id} value={network.id}>{network.name}</option>
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
                className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-xl text-sm font-mono"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setAddingType(null)}
                className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContract}
                disabled={!contractAddress || loading}
                className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase hover:bg-indigo-600 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Contract'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Component Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GitHub */}
        <button
          onClick={() => {
            setAddingType('github')
            if (isGithubAuthed && repositories.length === 0) {
              fetchRepositories()
            }
          }}
          className="card-premium p-6 hover:border-indigo-200 transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
            <Github size={24} />
          </div>
          <h3 className="font-black text-sm mb-2">GitHub</h3>
          <p className="text-xs text-slate-400">Import repository from GitHub</p>
        </button>

        {/* Contract */}
        <button
          onClick={() => setAddingType('contract')}
          className="card-premium p-6 hover:border-indigo-200 transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4 group-hover:bg-indigo-700 transition-colors">
            <FileCode size={24} />
          </div>
          <h3 className="font-black text-sm mb-2">Contract</h3>
          <p className="text-xs text-slate-400">Connect via network and address</p>
        </button>

        {/* DApp */}
        <button
          disabled
          className="card-premium p-6 opacity-50 cursor-not-allowed text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-4">
            <Globe size={24} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-black text-sm">DApp</h3>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black rounded uppercase">Soon</span>
          </div>
          <p className="text-xs text-slate-400">Scan live application</p>
        </button>

        {/* Dependencies */}
        <button
          disabled
          className="card-premium p-6 opacity-50 cursor-not-allowed text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-4">
            <Package size={24} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-black text-sm">Dependencies</h3>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black rounded uppercase">Soon</span>
          </div>
          <p className="text-xs text-slate-400">Check package vulnerabilities</p>
        </button>
      </div>

      {/* Components List */}
      {components.length > 0 && (
        <div>
          <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-4">Connected Sources</h3>
          <div className="space-y-3">
            {components.map(comp => (
              <div key={comp.id} className="card-premium p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  {comp.type === 'github-repo' ? <Github size={18} /> : <FileCode size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{comp.displayName}</p>
                  <p className="text-xs text-slate-400">{comp.type}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase flex-shrink-0 ${getStatusColor(comp.status)}`}>
                  {getStatusLabel(comp.status)}
                </span>
                <button
                  onClick={() => handleDeleteComponent(comp.id)}
                  disabled={deletingId === comp.id}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all flex-shrink-0 disabled:opacity-50"
                  title="Delete source"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
