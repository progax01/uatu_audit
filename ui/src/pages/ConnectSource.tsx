import { useState, useEffect } from 'react'
import { CheckCircle2, RefreshCw, ChevronRight } from 'lucide-react'
import logo from '../assets/logo.svg'

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
    // Save current URL to return after OAuth
    localStorage.setItem('oauth_return_url', window.location.pathname + window.location.search)
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Step Progress Indicator */}
        <div className="flex gap-4 mb-16">
          {/* Step 1 - Active */}
          <div className="flex-1">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/10 to-[#0F3F62]/5 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative border-2 border-[#0F3F62] bg-white backdrop-blur-sm rounded-lg px-6 py-4 shadow-lg shadow-[#0F3F62]/10">
                <div className="text-[#0F3F62] font-semibold text-lg">Step 1: Connect Source</div>
              </div>
            </div>
          </div>

          {/* Step 2 - Inactive */}
          <div className="flex-1">
            <div className="border border-gray-200 bg-gray-50 backdrop-blur-sm rounded-lg px-6 py-4">
              <div className="text-gray-400 font-semibold text-lg">Step 2: Configure Audit</div>
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
          {/* Glowing border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F3F62]/5 via-[#0F3F62]/3 to-[#0F3F62]/5 rounded-2xl blur-xl" />

          <div className="relative border border-gray-200 bg-white backdrop-blur-xl rounded-2xl p-12 shadow-xl">
            {/* Main Heading */}
            <h1 className="text-5xl font-bold text-[#0F3F62] mb-12 tracking-tight">
              Select Your Project Repository
            </h1>

            {/* Select Integration Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-[#0F3F62] mb-4">Select Integration</h2>

              {!isAuthenticated ? (
                <button
                  onClick={handleLogin}
                  className="w-full border-2 border-gray-200 bg-gray-50 hover:bg-white rounded-lg px-6 py-4 transition-all duration-200 hover:border-[#0F3F62] hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">Connect GitHub Account</span>
                    <ChevronRight className="w-5 h-5 text-[#0F3F62]" />
                  </div>
                </button>
              ) : (
                <div className="border-2 border-green-200 bg-green-50 rounded-lg px-6 py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 font-medium">
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
                    <h3 className="text-lg font-semibold text-[#0F3F62] mb-4">Select a Repository</h3>
                    <div className="space-y-3">
                      <select
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20 transition-all cursor-pointer appearance-none"
                        value={selectedRepo?.full_name || ''}
                        onChange={handleRepoChange}
                        disabled={loading}
                      >
                        <option value="" className="bg-white text-gray-400">Select a repository...</option>
                        {repositories.map((repo) => (
                          <option key={repo.id} value={repo.full_name} className="bg-white text-gray-700">
                            {repo.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right Column - Branch */}
                  <div>
                    <h3 className="text-lg font-semibold text-[#0F3F62] mb-4">Branch</h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <select
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:border-[#0F3F62] focus:ring-2 focus:ring-[#0F3F62]/20 transition-all cursor-pointer appearance-none disabled:opacity-50"
                          value={repoData.branch}
                          onChange={handleBranchChange}
                          disabled={!selectedRepo || loading}
                        >
                          <option value="" className="bg-white text-gray-400">
                            {selectedRepo ? 'Select branch...' : 'main'}
                          </option>
                          {branches.map((branch) => (
                            <option key={branch.name} value={branch.name} className="bg-white text-gray-700">
                              {branch.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={fetchRepositories}
                          disabled={loading}
                          className="p-3 border border-gray-200 bg-gray-50 hover:bg-white rounded-lg transition-all hover:border-[#0F3F62] disabled:opacity-50"
                        >
                          <RefreshCw className={`w-5 h-5 text-[#0F3F62] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      <button
                        onClick={fetchRepositories}
                        disabled={loading}
                        className="w-full border border-gray-200 bg-gray-50 hover:bg-white rounded-lg px-4 py-2.5 text-gray-600 hover:text-[#0F3F62] transition-all text-sm disabled:opacity-50"
                      >
                        Sync Repositories
                      </button>
                    </div>
                  </div>
                </div>

                {/* Manual Input Option */}
                <div className="flex items-center justify-between py-6 border-t border-gray-200">
                  <div className="flex items-center gap-3 text-gray-500 hover:text-[#0F3F62] transition-colors cursor-pointer group">
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
                        ? 'bg-[#0F3F62] text-white hover:bg-[#1a5a8a] shadow-lg shadow-[#0F3F62]/30 hover:shadow-[#0F3F62]/50'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
