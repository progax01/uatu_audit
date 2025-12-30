import { useState, useEffect } from 'react'
import { Layout, Github, Shield, Settings, Plus, ArrowRight, ExternalLink, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface Project {
  id: string
  full_name: string
  default_branch: string
  private: boolean
  lastAuditStatus?: 'success' | 'failure' | 'in_progress' | 'pending'
  lastAuditScore?: number
  lastAuditDate?: string
}

interface DashboardProps {
  onHomeClick: () => void
  onSettingsClick: () => void
  onViewAudit: (jobId: number) => void
  onNewAudit: () => void
}

export default function Dashboard({ onHomeClick, onSettingsClick, onViewAudit, onNewAudit }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/github/repos')
        const data = await res.json()
        // Mocking some audit data for the UI
        const enhancedData = data.map((p: any) => ({
          ...p,
          lastAuditStatus: Math.random() > 0.5 ? 'success' : 'pending',
          lastAuditScore: Math.floor(Math.random() * 40) + 60,
          lastAuditDate: new Date().toLocaleDateString()
        }))
        setProjects(enhancedData)
      } catch (err) {
        console.error('Failed to fetch projects', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F3F62] text-white flex flex-col">
        <div className="p-6 cursor-pointer" onClick={onHomeClick}>
          <img src="/logo.svg" alt="Uatu" className="h-8 brightness-0 invert" />
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 text-white font-medium">
            <Layout className="w-5 h-5" />
            Projects
          </button>
          <button 
            onClick={onSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
              <span className="text-sm font-medium">Uatu Daemon Active</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Monitoring 4 connected repositories for branch protection.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-bold text-[#0F3F62]">Security Dashboard</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={onNewAudit}
              className="flex items-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-900/10"
            >
              <Plus className="w-4 h-4" />
              New Audit
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-8 h-8 border-4 border-[#0F3F62] border-t-transparent rounded-full animate-spin mb-4" />
              <p>Fetching your repositories...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 gap-6">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between hover:shadow-xl hover:shadow-gray-200/50 transition-all group"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                        <Github className="w-7 h-7 text-[#0F3F62]" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-gray-900 text-lg">{project.full_name}</h3>
                          {project.private && (
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Private</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {project.lastAuditDate}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="font-mono text-xs">{project.default_branch}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      {project.lastAuditStatus === 'success' ? (
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-2xl font-black text-gray-900">{project.lastAuditScore}</span>
                            <span className="text-sm font-bold text-gray-400">/100</span>
                          </div>
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">SECURE</span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-1 text-gray-400">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm font-medium italic">Pending Triage</span>
                          </div>
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-widest">Incomplete</span>
                        </div>
                      )}

                      <button 
                        onClick={() => onViewAudit(123)} // Mocking jobId
                        className="flex items-center gap-2 bg-gray-50 hover:bg-[#0F3F62] hover:text-white text-gray-600 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                      >
                        Details
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

