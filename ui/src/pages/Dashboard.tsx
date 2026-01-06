import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layout, Settings, Plus, ArrowRight, Clock,
  FileCode, Globe, Package,
  FolderGit2, ShieldCheck, Shield, Activity, ShieldAlert
} from 'lucide-react'
import { PremiumShield } from '../components/IconSystem'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'

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
      <MouseTooltip />
      {/* Sidebar */}
      <aside className="w-72 bg-white/80 backdrop-blur-2xl border-r border-black/[0.03] flex flex-col z-[100] shadow-sm">
        <div className="p-10 cursor-pointer flex items-center group" onClick={onHomeClick}>
          <img src={logo} alt="Uatu Security" className="h-9 object-contain group-hover:scale-105 transition-all duration-700" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider transition-all border border-indigo-100/30">
            <Layout size={14} strokeWidth={2.5} />
            Command Center
          </button>
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 font-bold text-[10px] uppercase tracking-wider transition-all"
          >
            <Shield size={14} strokeWidth={2.5} />
            Protocols
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 font-bold text-[10px] uppercase tracking-wider transition-all"
          >
            <Settings size={14} strokeWidth={2.5} />
            Scan Node
          </button>
        </nav>

        <div className="p-6">
          <div className="glass-liquid rounded-2xl p-4 border-white/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-[0.03]">
              <Activity size={40} className="text-indigo-900" />
            </div>
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Security Pulse</span>
            </div>
            <p className="text-[8px] text-slate-500 font-bold leading-relaxed uppercase tracking-wider relative z-10">
              Uatu Node: Connected
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Artistic Atmosphere */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.02] blur-[120px] rounded-full pointer-events-none" />

        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 shrink-0 z-10 bg-white/70 backdrop-blur-xl border-b border-black/[0.03]">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Security Command Center</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Verified Infrastructure / security control plane</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onNewAudit}
              className="btn-primary py-2 px-6"
            >
              <Plus size={14} strokeWidth={3} />
              Secure New Project
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-10 z-10">
          {/* Dashboard Stats Row */}
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-4 gap-6 mb-10 max-w-6xl mx-auto">
              {[
                { label: 'Total Audits', value: projects.length, icon: Shield },
                { label: 'Critical Vulns', value: '12', icon: ShieldAlert, color: 'text-rose-500' },
                { label: 'Verified Code', value: '820K Lines', icon: FileCode },
                { label: 'Network Health', value: '98.2%', icon: Activity, color: 'text-emerald-500' },
              ].map((stat) => (
                <div key={stat.label} className="card-premium !p-5 bg-white/50">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon size={14} className={stat.color || 'text-slate-400'} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
                  </div>
                  <div className="text-xl font-black text-slate-900">{stat.value}</div>
                </div>
              ))}
            </div>
          )}
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
                <p className="tracking-[0.3em] uppercase opacity-40">Synchronizing Security Data...</p>
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
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">No Active Security.</h2>
                <p className="text-slate-400 mb-10 font-medium leading-relaxed max-w-sm uppercase text-[9px] tracking-[0.2em] opacity-80">
                  Your project command center is currently empty. Secure your first project to begin monitoring.
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
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.5 }}
                        className="group relative card-premium !p-5 flex items-center justify-between hover:bg-white transition-all shadow-sm border-black/[0.02]"
                      >
                        <div className="flex items-center gap-6">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white border border-black/[0.03] shadow-sm transition-all duration-500 group-hover:scale-105 ${typeConfig.colorClass}`}>
                            <TypeIcon size={20} strokeWidth={2} />
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <h3 className="font-black text-slate-900 text-base tracking-tight">{project.name}</h3>
                              <div className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${statusConfig.colorClass}`}>
                                {statusConfig.label}
                              </div>
                            </div>
                            <div className="flex items-center gap-5 text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60 mt-1">
                              <span className="flex items-center gap-1.5">
                                <Package size={12} strokeWidth={2.5} />
                                {project.componentCount} Nodes
                              </span>
                              {project.lastAuditAt && (
                                <span className="flex items-center gap-1.5">
                                  <Clock size={12} strokeWidth={2.5} />
                                  {new Date(project.lastAuditAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-10">
                          {project.aggregatedScore ? (
                            <div className="text-right flex flex-col items-end gap-1">
                              <div className="text-xl font-black text-slate-900 tabular-nums">
                                {project.aggregatedScore.value}
                                <span className="text-[8px] text-slate-300 ml-1.5 font-bold uppercase tracking-widest">/ 100</span>
                              </div>
                              <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${project.aggregatedScore.grade === 'A' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                project.aggregatedScore.grade === 'B' ? 'text-indigo-600 bg-indigo-50 border-indigo-100' :
                                  'text-amber-600 bg-amber-50 border-amber-100'
                                }`}>
                                Grade {project.aggregatedScore.grade}
                              </div>
                            </div>
                          ) : (
                            <div className="text-right flex flex-col items-end gap-1 opacity-30 group-hover:opacity-100 transition-all">
                              <div className="text-[8px] font-black text-slate-900 uppercase tracking-widest">
                                {project.status === 'auditing' ? 'Security Scan Active' : 'Scan Pending'}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => project.lastAuditJobId ? onViewAudit(project.lastAuditJobId) : null}
                            disabled={!project.lastAuditJobId}
                            className="w-10 h-10 rounded-xl bg-white border border-black/[0.04] shadow-sm flex items-center justify-center hover:bg-slate-900 hover:text-white hover:scale-105 transition-all text-slate-400 group/btn"
                          >
                            <ArrowRight size={16} strokeWidth={2.5} className="group-hover/btn:translate-x-0.5" />
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
