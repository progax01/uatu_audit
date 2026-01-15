import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  GitBranch, ArrowRight, Plus, X, ChevronRight,
  FileCode, Globe, Package,
  ShieldCheck, Shield, FolderGit2, Clock, Github, Zap, Search, AlertTriangle
} from 'lucide-react'
import { getStoredUser, authFetch } from '../services/authService'
import { Link, useNavigate } from 'react-router-dom'

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
  lastAuditJobId?: number | string
  category?: string
  repoUrl?: string
  branch?: string
  aggregatedScore?: {
    value: number
    grade: string
  }
}

interface DashboardProps {
  onViewAudit: (slug: string) => void
  onNewAudit: () => void
}

const PROJECT_TYPE_CONFIG: Record<ProjectType, { label: string; icon: any; colorClass: string }> = {
  'full': { label: 'Full Audit', icon: Shield, colorClass: 'text-indigo-600' },
  'contract-only': { label: 'Contracts Only', icon: FileCode, colorClass: 'text-slate-600' },
  'dapp-pentest': { label: 'dApp Pentest', icon: Globe, colorClass: 'text-emerald-500' },
  'library-audit': { label: 'Library Audit', icon: Package, colorClass: 'text-amber-500' }
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; colorClass: string }> = {
  'draft': { label: 'NOT CONFIGURED', colorClass: 'text-slate-400 bg-slate-100 border-slate-200' },
  'configured': { label: 'READY', colorClass: 'text-blue-600 bg-blue-50 border-blue-100' },
  'awaiting-preaudit': { label: 'PENDING', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
  'auditing': { label: 'AUDITING', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100 animate-pulse' },
  'completed': { label: 'COMPLETED', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
}

export default function Dashboard({ onViewAudit, onNewAudit }: DashboardProps) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const storedUser = getStoredUser()
    setUser(storedUser)

    const loadProjects = async () => {
      try {
        const response = await authFetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          const transformedProjects = (data.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            type: p.type || 'full',
            status: p.status || 'draft',
            componentCount: p.componentCount || 0,
            lastAuditAt: p.lastAuditAt,
            lastAuditJobId: p.lastAuditJobId,
            aggregatedScore: p.aggregatedScore,
            category: p.category,
          }))
          setProjects(transformedProjects)
        }
      } catch (err) {
        console.error('Failed to load projects', err)
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  const handleCreateProject = async () => {
    if (projectName.trim().length < 3) return

    setIsCreating(true)
    setCreateError(null)

    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          type: 'contract-only',
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

      // Close modal and reset form
      setShowCreateModal(false)
      setProjectName('')
      setProjectDescription('')

      // Navigate to project details
      navigate(`/project/${project.slug}`)
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Loading Projects...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setShowCreateModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl relative"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all z-10"
            >
              <X size={18} />
            </button>

            <div className="p-6 space-y-4">

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My DeFi Protocol"
                    className="w-full h-10 px-3 bg-white border border-black/[0.05] rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-black/[0.05] rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all resize-none"
                  />
                </div>

                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-medium">
                    {createError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 h-10 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={projectName.trim().length < 3 || isCreating}
                    className="flex-1 h-10 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                    {!isCreating && <ChevronRight size={14} />}
                  </button>
                </div>

                <p className="text-center text-[10px] text-slate-400">
                  You'll add sources after creating the project
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="space-y-8 animate-reveal">
        {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-premium relative overflow-hidden py-16"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
            <Shield size={300} strokeWidth={1} />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Start Your First Audit</h2>
              <p className="text-slate-400 font-medium text-[14px] max-w-md mx-auto">
                Choose how you want to audit your smart contracts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quick Scan Option */}
              <Link
                to="/quick-scan"
                className="group p-8 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50 transition-all cursor-pointer"
              >
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-200">
                  <Zap size={24} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Quick Scan</h3>
                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                  Paste a contract address and get instant security analysis. No setup required.
                </p>
                <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold">
                  <Search size={14} />
                  Scan by Address
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* New Project Option */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="group p-8 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-50 transition-all cursor-pointer text-left"
              >
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-slate-200">
                  <Github size={24} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">New Project</h3>
                <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                  Connect a GitHub repository for comprehensive audits with branch tracking.
                </p>
                <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                  <FolderGit2 size={14} />
                  Setup Project
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onViewAudit(project.slug)}
              className="card-premium group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-8">
                <div className={`w-14 h-14 rounded-2xl border border-black/[0.02] flex items-center justify-center transition-all ${
                  project.componentCount === 0
                    ? 'bg-amber-50 group-hover:bg-amber-500'
                    : 'bg-slate-50 group-hover:bg-indigo-600 group-hover:shadow-xl group-hover:shadow-indigo-100'
                } group-hover:text-white`}>
                  {project.componentCount === 0 ? (
                    <AlertTriangle size={24} strokeWidth={2} className="text-amber-500 group-hover:text-white transition-colors" />
                  ) : project.type && PROJECT_TYPE_CONFIG[project.type] ? (
                    <div className={PROJECT_TYPE_CONFIG[project.type].colorClass}>
                      {(() => {
                        const Icon = PROJECT_TYPE_CONFIG[project.type].icon
                        return <Icon size={24} strokeWidth={2} className="group-hover:text-white transition-colors" />
                      })()}
                    </div>
                  ) : (
                    <Shield size={24} strokeWidth={2} className="text-slate-400 group-hover:text-white" />
                  )}
                </div>
                {project.componentCount === 0 ? (
                  <div className="px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border-amber-100">
                    INCOMPLETE
                  </div>
                ) : (
                  <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[project.status]?.colorClass || 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                    {STATUS_CONFIG[project.status]?.label || project.status}
                  </div>
                )}
              </div>

              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">
                {project.name}
              </h3>

              <div className="space-y-2 mb-8">
                {project.componentCount === 0 ? (
                  <div className="flex items-center gap-2 text-[12px] text-amber-600">
                    <AlertTriangle size={12} />
                    <span className="font-medium">Click to complete setup or delete</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-[12px] text-slate-400">
                      <GitBranch size={12} />
                      <span className="font-medium">{project.branch || 'main'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-slate-400">
                      <FileCode size={12} />
                      <span className="font-medium">{project.componentCount} source{project.componentCount !== 1 ? 's' : ''}</span>
                    </div>
                    {project.lastAuditAt && (
                      <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <Clock size={12} />
                        <span className="font-medium">Last audit {new Date(project.lastAuditAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-black/[0.03] flex items-center justify-between">
                {project.aggregatedScore ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                      <ShieldCheck size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider leading-none mb-1">Score</div>
                      <div className="text-sm font-black text-slate-900 leading-none">
                        {project.aggregatedScore.value}% <span className="text-emerald-500">{project.aggregatedScore.grade}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    No audits yet
                  </div>
                )}
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ArrowRight size={16} strokeWidth={2.5} />
                </div>
              </div>
            </motion.div>
          ))}

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: projects.length * 0.05 }}
            onClick={() => setShowCreateModal(true)}
            className="group card-premium !bg-transparent border-2 border-dashed border-slate-200 hover:border-indigo-300 flex flex-col items-center justify-center text-center gap-4 transition-all hover:bg-white min-h-[280px]"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-indigo-100 transition-all">
              <Plus size={28} strokeWidth={2.5} />
            </div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-all">Add Project</div>
          </motion.button>
        </div>
      )}
      </div>
    </>
  )
}
