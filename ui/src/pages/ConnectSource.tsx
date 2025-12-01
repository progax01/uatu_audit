import { useState, useEffect } from 'react'
import { CheckCircle2, RefreshCw, ChevronRight } from 'lucide-react'
import logo from '../assets/icon_audits.png'

interface ConnectSourceProps {
  onNext: () => void
  onHomeClick: () => void
  repoData: {
    repo: string
    branch: string
    project: string
  }
  setRepoData: (data: any) => void
}

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

export default function ConnectSource({ onNext, onHomeClick, repoData, setRepoData }: ConnectSourceProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/github/me')
      const data = await res.json()
      if (data.authed) {
        setIsAuthenticated(true)
        setUser(data.user)
        fetchRepositories()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    }
  }

  const handleLogin = () => {
    window.location.href = '/auth/github/login'
  }

  const fetchRepositories = async () => {
    setLoading(true)
    try {
      const res = await fetch('/github/repos')
      const data = await res.json()
      setRepositories(data)
    } catch (error) {
      console.error('Failed to fetch repos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async (repoFullName: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/github/branches?repo=${encodeURIComponent(repoFullName)}`)
      const data = await res.json()
      setBranches(data)
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repo = repositories.find(r => r.full_name === e.target.value)
    if (repo) {
      setSelectedRepo(repo)
      setRepoData({ ...repoData, repo: repo.clone_url, project: repo.full_name.split('/')[1] })
      fetchBranches(repo.full_name)
    }
  }

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRepoData({ ...repoData, branch: e.target.value })
  }

  const canProceed = repoData.repo && repoData.branch && repoData.project

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

      {/* Circuit Board Accents */}
      <div className="absolute top-0 left-0 w-64 h-64 opacity-10">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="20" cy="20" r="2" fill="#00ffff" />
          <circle cx="180" cy="20" r="2" fill="#00ffff" />
          <circle cx="20" cy="180" r="2" fill="#00ffff" />
          <line x1="20" y1="20" x2="180" y2="20" stroke="#00ffff" strokeWidth="1" />
          <line x1="20" y1="20" x2="20" y2="180" stroke="#00ffff" strokeWidth="1" />
        </svg>
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
          {/* Step 1 - Active */}
          <div className="flex-1">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/20 to-[#00ffff]/10 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative border-2 border-[#00ffff] bg-[#0a0f1f]/80 backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg shadow-[#00ffff]/20">
                <div className="text-[#00ffff] font-semibold text-lg">Step 1: Connect Source</div>
              </div>
            </div>
          </div>

          {/* Step 2 - Inactive */}
          <div className="flex-1">
            <div className="border border-gray-700/50 bg-[#1a1f2e]/50 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-gray-500 font-semibold text-lg">Step 2: Configure Audit</div>
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
          {/* Glowing border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/10 via-[#0099ff]/5 to-[#00ffff]/10 rounded-2xl blur-xl" />

          <div className="relative border border-[#00ffff]/30 bg-[#0d1426]/90 backdrop-blur-xl rounded-2xl p-12 shadow-2xl">
            {/* Main Heading */}
            <h1 className="text-5xl font-bold text-white mb-12 tracking-tight">
              Select Your Project Repository
            </h1>

            {/* Select Integration Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Select Integration</h2>

              {!isAuthenticated ? (
                <button
                  onClick={handleLogin}
                  className="w-full border-2 border-[#00ffff]/30 bg-[#0a0f1f]/80 hover:bg-[#0a0f1f] rounded-lg px-6 py-4 transition-all duration-200 hover:border-[#00ffff]/60 hover:shadow-lg hover:shadow-[#00ffff]/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-medium">Connect GitHub Account</span>
                    <ChevronRight className="w-5 h-5 text-[#00ffff]" />
                  </div>
                </button>
              ) : (
                <div className="border-2 border-green-500/30 bg-[#0a0f1f]/60 rounded-lg px-6 py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-gray-200 font-medium">
                      Connected as: {user?.login || 'your-github-username'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isAuthenticated && (
              <>
                {/* Repository and Branch Selection - Two Columns */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  {/* Left Column - Repository */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Select a Repository</h3>
                    <div className="space-y-3">
                      <select
                        className="w-full bg-[#0a0f1f]/80 border border-[#00ffff]/20 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-[#00ffff]/60 focus:ring-1 focus:ring-[#00ffff]/30 transition-all cursor-pointer appearance-none"
                        value={selectedRepo?.full_name || ''}
                        onChange={handleRepoChange}
                        disabled={loading}
                      >
                        <option value="" className="bg-[#0a0f1f] text-gray-400">Select a repository...</option>
                        {repositories.map((repo) => (
                          <option key={repo.id} value={repo.full_name} className="bg-[#0a0f1f] text-gray-200">
                            {repo.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right Column - Branch */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Branch</h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <select
                          className="flex-1 bg-[#0a0f1f]/80 border border-[#00ffff]/20 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-[#00ffff]/60 focus:ring-1 focus:ring-[#00ffff]/30 transition-all cursor-pointer appearance-none disabled:opacity-50"
                          value={repoData.branch}
                          onChange={handleBranchChange}
                          disabled={!selectedRepo || loading}
                        >
                          <option value="" className="bg-[#0a0f1f] text-gray-400">
                            {selectedRepo ? 'Select branch...' : 'main'}
                          </option>
                          {branches.map((branch) => (
                            <option key={branch.name} value={branch.name} className="bg-[#0a0f1f] text-gray-200">
                              {branch.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={fetchRepositories}
                          disabled={loading}
                          className="p-3 border border-[#00ffff]/30 bg-[#0a0f1f]/80 hover:bg-[#0a0f1f] rounded-lg transition-all hover:border-[#00ffff]/60 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-5 h-5 text-[#00ffff] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      <button
                        onClick={fetchRepositories}
                        disabled={loading}
                        className="w-full border border-[#00ffff]/30 bg-[#0a0f1f]/60 hover:bg-[#0a0f1f] rounded-lg px-4 py-2.5 text-gray-300 hover:text-white transition-all text-sm disabled:opacity-50"
                      >
                        Sync Repositories
                      </button>
                    </div>
                  </div>
                </div>

                {/* Manual Input Option */}
                <div className="flex items-center justify-between py-6 border-t border-gray-700/30">
                  <div className="flex items-center gap-3 text-gray-400 hover:text-gray-300 transition-colors cursor-pointer group">
                    <span className="font-medium">Manual Input (Public Repo or Upload</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className={`
                      relative px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200
                      ${canProceed
                        ? 'bg-[#00ffff] text-[#0a0f1f] hover:bg-[#00e6e6] shadow-lg shadow-[#00ffff]/30 hover:shadow-[#00ffff]/50'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    Next: Define Scope
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
