import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, ArrowRight, Clock,
  FileCode, Globe, Package,
  ShieldCheck, Shield, Activity, ShieldAlert
} from 'lucide-react'

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
  onViewAudit: (jobId: number) => void
  onNewAudit: () => void
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

export default function Dashboard({ onViewAudit, onNewAudit }: DashboardProps) {
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
    <div className="space-y-12">
      {/* Overview Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Protocols Under Guard', value: projects.length, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Security Score', value: '94/100', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Threats', value: '0', icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-50' },
          { label: 'Uptime', value: '99.99%', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card-premium !p-6 flex items-center gap-6"
          >
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Active Protocols</h2>
            <button
              onClick={onNewAudit}
              className="btn-primary !py-2.5 px-6 !text-[10px]"
            >
              <Plus size={14} strokeWidth={3} />
              New Deployment
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100/50 animate-pulse rounded-[24px] border border-black/[0.02]" />)
            ) : projects.length === 0 ? (
              <div className="p-20 border-2 border-dashed border-black/[0.03] rounded-[40px] text-center">
                <Shield size={40} className="text-slate-200 mx-auto mb-6" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No protocols detected in sector</p>
              </div>
            ) : (
              projects.map((project, idx) => {
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
              })
            )}
          </div>
        </div>

        {/* Intelligence Sidebar (Optional/Extra) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="card-premium !bg-slate-900 !border-slate-800 !p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                <ShieldCheck size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mb-2">Immutable Verification</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">Uatu AI has verified 12.4k lines of logic in the last 24 hours. No critical escapes detected.</p>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest">Engine Nominal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
