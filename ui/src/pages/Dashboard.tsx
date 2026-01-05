import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layout, Settings, Plus, ArrowRight, Clock,
  FileCode, Globe, Package,
  FolderGit2, ShieldCheck, Shield
} from 'lucide-react'
import logo from '../assets/logo.svg'

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

const PROJECT_TYPE_CONFIG: Record<ProjectType, { label: string; icon: any; colorClass: string }> = {
  'full': { label: 'Full Audit', icon: Shield, colorClass: 'text-indigo-600' },
  'contract-only': { label: 'Contracts', icon: FileCode, colorClass: 'text-blue-600' },
  'dapp-pentest': { label: 'DApp', icon: Globe, colorClass: 'text-emerald-600' },
  'library-audit': { label: 'Library', icon: Package, colorClass: 'text-amber-600' }
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; colorClass: string }> = {
  'draft': { label: 'Draft', colorClass: 'text-slate-400 bg-slate-50 border-slate-100' },
  'configured': { label: 'Configured', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  'awaiting-preaudit': { label: 'Awaiting Input', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
  'auditing': { label: 'Auditing', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse' },
  'completed': { label: 'Completed', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
}

export default function Dashboard({ onHomeClick, onSettingsClick, onViewAudit, onNewAudit }: DashboardProps) {
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
    <div className="min-h-screen bg-base flex selection:bg-indigo-500/20">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-black/[0.03] flex flex-col z-[100] shadow-[10px_0_30px_rgba(0,0,0,0.01)]">
        <div className="p-10 cursor-pointer flex items-center group" onClick={onHomeClick}>
          <img src={logo} alt="Uatu Sovereignty Hub" className="h-10 object-contain group-hover:scale-105 transition-transform duration-500" />
        </div>

        <nav className="flex-1 px-6 py-4 space-y-3">
          <button className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-indigo-100/50 shadow-sm shadow-indigo-500/5">
            <Layout size={18} strokeWidth={1.5} />
            Command Center
          </button>
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] transition-all"
          >
            <Settings size={18} strokeWidth={1.5} />
            Protocols
          </button>
        </nav>

        <div className="p-8">
          <div className="bg-slate-50 rounded-[32px] p-8 border border-black/[0.02] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
              <Activity size={80} className="text-indigo-900" />
            </div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Pulse</span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-[0.1em] relative z-10 max-w-[160px]">
              Monitoring engineering standards across your connected infrastructure points.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Artistic Atmosphere */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.02] blur-[120px] rounded-full pointer-events-none" />

        {/* Header */}
        <header className="h-28 flex items-center justify-between px-12 shrink-0 z-10 bg-white/70 backdrop-blur-xl border-b border-black/[0.03]">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-[-0.04em]">Security Control Plane</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2 italic opacity-60">Uatu Hub / Integrated Infrastructure</p>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={onNewAudit}
              className="btn-primary"
            >
              <Plus size={16} strokeWidth={3} />
              Establish Sovereignty
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-12 z-10">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full text-slate-400 font-black text-[10px]"
              >
                <div className="relative w-12 h-12 mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-indigo-600/30" strokeWidth={1.5} />
                  </div>
                </div>
                <p className="tracking-[0.3em] uppercase opacity-40">Decrypting Sovereignty Hub...</p>
              </motion.div>
            ) : projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl mx-auto text-center py-32 flex flex-col items-center card !bg-white/40 !backdrop-blur-3xl"
              >
                <div className="w-24 h-24 bg-white border border-black/[0.04] shadow-premium rounded-[40px] flex items-center justify-center mb-10 transition-transform duration-700 hover:scale-110">
                  <FolderGit2 className="w-10 h-10 text-indigo-200" strokeWidth={1.5} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">No Active Sovereignty.</h2>
                <p className="text-slate-400 mb-12 font-medium leading-relaxed max-w-sm uppercase text-[10px] tracking-[0.2em] opacity-80">
                  Your project command center is offline. Initialize your first node to begin monitoring.
                </p>
                <button
                  onClick={onNewAudit}
                  className="btn-primary"
                >
                  <Plus size={18} strokeWidth={3} />
                  Initialize Node
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-6xl mx-auto"
              >
                <div className="grid grid-cols-1 gap-8">
                  {projects.map((project, idx) => {
                    const typeConfig = PROJECT_TYPE_CONFIG[project.type] || PROJECT_TYPE_CONFIG['full']
                    const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG['draft']
                    const TypeIcon = typeConfig.icon

                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="group relative card !p-10 !bg-white/60 !backdrop-blur-3xl flex items-center justify-between hover:translate-x-2"
                      >
                        <div className="flex items-center gap-10">
                          <div className={`w-18 h-18 rounded-[28px] flex items-center justify-center bg-white border border-black/[0.03] shadow-sm transition-all duration-700 group-hover:scale-110 group-hover:shadow-indigo-500/10 ${typeConfig.colorClass}`}>
                            <TypeIcon size={36} strokeWidth={1.5} />
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4">
                              <h3 className="font-black text-slate-900 text-3xl tracking-[-0.04em]">{project.name}</h3>
                              <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm ${statusConfig.colorClass}`}>
                                {statusConfig.label}
                              </div>
                            </div>
                            <div className="flex items-center gap-8 text-[10px] text-slate-400 font-black uppercase tracking-[0.25em] opacity-60">
                              <span className="flex items-center gap-2.5">
                                <Package size={14} strokeWidth={2} />
                                {project.componentCount} Nodes
                              </span>
                              {project.lastAuditAt && (
                                <span className="flex items-center gap-2.5">
                                  <Clock size={14} strokeWidth={2} />
                                  SYNC: {new Date(project.lastAuditAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-16">
                          {project.aggregatedScore ? (
                            <div className="text-right">
                              <div className="flex items-center gap-3 justify-end mb-3">
                                <div className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">
                                  {project.aggregatedScore.value}
                                  <span className="text-[10px] text-slate-300 ml-2 font-black tracking-widest uppercase">/ 100</span>
                                </div>
                              </div>
                              <div className={`text-[9px] font-black uppercase tracking-[0.4em] px-4 py-2 rounded-2xl inline-block border shadow-sm ${project.aggregatedScore.grade === 'A' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                project.aggregatedScore.grade === 'B' ? 'text-indigo-600 bg-indigo-50 border-indigo-100' :
                                  'text-amber-600 bg-amber-50 border-amber-100'
                                }`}>
                                Grade {project.aggregatedScore.grade}
                              </div>
                            </div>
                          ) : (
                            <div className="text-right flex flex-col items-end gap-2 pr-4 opacity-30 group-hover:opacity-100 transition-all duration-500">
                              <div className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">
                                {project.status === 'auditing' ? 'Security Pulse Active' : 'Sovereignty Awaited'}
                              </div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {project.status === 'auditing' ? 'Running Deterministic Scan...' : 'Command Pending'}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => project.lastAuditJobId ? onViewAudit(project.lastAuditJobId) : null}
                            disabled={!project.lastAuditJobId}
                            className="w-14 h-14 rounded-[22px] bg-white border border-black/[0.04] shadow-sm flex items-center justify-center hover:bg-slate-900 hover:text-white hover:scale-110 transition-all duration-500 text-slate-400 group/btn"
                          >
                            <ArrowRight size={20} strokeWidth={3} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
