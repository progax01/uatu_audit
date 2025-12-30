import { useState, useEffect } from 'react'
import { Layout, Shield, Settings, Plus, ArrowRight, Clock, CheckCircle, AlertCircle, FileCode, Globe, Package, FolderGit2 } from 'lucide-react'

type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit'
type ProjectStatus = 'draft' | 'configured' | 'awaiting-preaudit' | 'auditing' | 'completed'

interface Project {
  id: string
  name: string
  slug: string
  type: ProjectType
  status: ProjectStatus
  componentCount: number
  lastAuditAt?: string
  lastAuditJobId?: number
  aggregatedScore?: {
    value: number
    grade: string
  }
}

interface DashboardProps {
  onHomeClick: () => void
  onSettingsClick: () => void
  onViewAudit: (jobId: number) => void
  onNewAudit: () => void
  onNewLegacyAudit?: () => void
}

const PROJECT_TYPE_CONFIG: Record<ProjectType, { label: string; icon: any; color: string }> = {
  'full': { label: 'Full Audit', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  'contract-only': { label: 'Contracts', icon: FileCode, color: 'bg-blue-100 text-blue-700' },
  'dapp-pentest': { label: 'DApp', icon: Globe, color: 'bg-green-100 text-green-700' },
  'library-audit': { label: 'Library', icon: Package, color: 'bg-orange-100 text-orange-700' }
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  'draft': { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  'configured': { label: 'Configured', color: 'bg-blue-100 text-blue-600' },
  'awaiting-preaudit': { label: 'Awaiting Input', color: 'bg-yellow-100 text-yellow-700' },
  'auditing': { label: 'Auditing', color: 'bg-purple-100 text-purple-700' },
  'completed': { label: 'Completed', color: 'bg-green-100 text-green-700' }
}

export default function Dashboard({ onHomeClick, onSettingsClick, onViewAudit, onNewAudit, onNewLegacyAudit }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data.projects || [])
        } else {
          // Fallback to empty if API not available
          setProjects([])
        }
      } catch (err) {
        console.error('Failed to fetch projects', err)
        setProjects([])
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
              <p>Fetching your projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderGit2 className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">No Projects Yet</h2>
              <p className="text-gray-500 mb-8">
                Create your first project to start auditing smart contracts, DApps, and more.
              </p>
              <button
                onClick={onNewAudit}
                className="inline-flex items-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-5 h-5" />
                Create Your First Project
              </button>
              {onNewLegacyAudit && (
                <button
                  onClick={onNewLegacyAudit}
                  className="block mx-auto mt-4 text-gray-500 hover:text-[#0F3F62] font-medium transition-colors"
                >
                  Or use legacy single-repo audit
                </button>
              )}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 gap-6">
                {projects.map((project) => {
                  const typeConfig = PROJECT_TYPE_CONFIG[project.type] || PROJECT_TYPE_CONFIG['full']
                  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG['draft']
                  const TypeIcon = typeConfig.icon

                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between hover:shadow-xl hover:shadow-gray-200/50 transition-all group"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform ${typeConfig.color.replace('text-', 'bg-').replace('-700', '-50').replace('-100', '-50')}`}>
                          <TypeIcon className={`w-7 h-7 ${typeConfig.color.split(' ')[1]}`} />
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-gray-900 text-lg">{project.name}</h3>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${typeConfig.color}`}>
                              {typeConfig.label}
                            </span>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Package className="w-4 h-4" />
                              {project.componentCount} source{project.componentCount !== 1 ? 's' : ''}
                            </span>
                            {project.lastAuditAt && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  {new Date(project.lastAuditAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        {project.aggregatedScore ? (
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end mb-1">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="text-2xl font-black text-gray-900">{project.aggregatedScore.value}</span>
                              <span className="text-sm font-bold text-gray-400">/100</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              project.aggregatedScore.grade === 'A' ? 'text-green-600 bg-green-50' :
                              project.aggregatedScore.grade === 'B' ? 'text-blue-600 bg-blue-50' :
                              project.aggregatedScore.grade === 'C' ? 'text-yellow-600 bg-yellow-50' :
                              project.aggregatedScore.grade === 'D' ? 'text-orange-600 bg-orange-50' :
                              'text-red-600 bg-red-50'
                            }`}>
                              Grade {project.aggregatedScore.grade}
                            </span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end mb-1 text-gray-400">
                              <AlertCircle className="w-5 h-5" />
                              <span className="text-sm font-medium italic">
                                {project.status === 'auditing' ? 'In Progress' : 'Not Audited'}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-widest">
                              {project.status === 'auditing' ? 'Running' : 'Pending'}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => project.lastAuditJobId ? onViewAudit(project.lastAuditJobId) : null}
                          disabled={!project.lastAuditJobId}
                          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                            project.lastAuditJobId
                              ? 'bg-gray-50 hover:bg-[#0F3F62] hover:text-white text-gray-600'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Details
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legacy Audit Link */}
              {onNewLegacyAudit && (
                <div className="mt-8 text-center">
                  <button
                    onClick={onNewLegacyAudit}
                    className="text-gray-400 hover:text-[#0F3F62] text-sm font-medium transition-colors"
                  >
                    Use legacy single-repo audit
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

