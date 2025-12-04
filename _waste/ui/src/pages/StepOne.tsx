import { useState, useEffect } from 'react'

interface StepOneProps {
  onNext: () => void
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

export default function StepOne({ onNext, repoData, setRepoData }: StepOneProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(false)

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

  const handleLogout = async () => {
    await fetch('/auth/github/logout', { method: 'POST' })
    setIsAuthenticated(false)
    setUser(null)
    setRepositories([])
    setBranches([])
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
      setRepoData({ ...repoData, repo: repo.clone_url })
      fetchBranches(repo.full_name)
    }
  }

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRepoData({ ...repoData, branch: e.target.value })
  }

  const handleProjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoData({ ...repoData, project: e.target.value })
  }

  const canProceed = repoData.repo && repoData.branch && repoData.project

  return (
    <div className="card max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-uatu-text mb-6">GitHub Connection</h2>

      {/* Auth Section */}
      <div className="mb-6 p-4 bg-uatu-input rounded-uatu-sm border border-uatu-input-border">
        {!isAuthenticated ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-uatu-text font-medium">Connect your GitHub account</p>
              <p className="text-uatu-muted text-sm mt-1">
                Required to access your repositories
              </p>
            </div>
            <button onClick={handleLogin} className="btn-primary">
              Connect GitHub
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="text-uatu-text font-medium">
                  Welcome, {user?.login || 'User'}
                </p>
                <p className="text-uatu-muted text-sm">{user?.email || 'GitHub user'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <>
          {/* Repository Selection */}
          <div className="mb-4">
            <label className="block text-uatu-text font-medium mb-2">Repository</label>
            <div className="flex gap-2">
              <select
                className="select flex-1"
                value={selectedRepo?.full_name || ''}
                onChange={handleRepoChange}
                disabled={loading}
              >
                <option value="">Select a repository...</option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.full_name}>
                    {repo.full_name} {repo.private ? '(private)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchRepositories}
                className="btn-secondary"
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Branch Selection */}
          {selectedRepo && (
            <div className="mb-4">
              <label className="block text-uatu-text font-medium mb-2">Branch</label>
              <select
                className="select w-full"
                value={repoData.branch}
                onChange={handleBranchChange}
                disabled={loading}
              >
                <option value="">Select a branch...</option>
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.protected ? '(protected)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project Slug */}
          {selectedRepo && repoData.branch && (
            <div className="mb-6">
              <label className="block text-uatu-text font-medium mb-2">Project Slug</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="my-project-slug"
                  value={repoData.project}
                  onChange={handleProjectChange}
                />
                <button
                  onClick={() => {
                    const slug = selectedRepo.full_name.split('/')[1] || 'project'
                    setRepoData({ ...repoData, project: slug })
                  }}
                  className="btn-secondary"
                >
                  Autofill
                </button>
              </div>
            </div>
          )}

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={`btn-primary ${!canProceed ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Next: Configure Audit →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
