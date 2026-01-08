import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, ArrowRight, Plus,
  FileCode, Globe, Package,
  ShieldCheck, Shield, Sparkles
} from 'lucide-react'
import { getStoredUser, authFetch } from '../services/authService'

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
  'full': { label: 'Full Scan', icon: Shield, colorClass: 'text-indigo-600' },
  'contract-only': { label: 'Contracts', icon: FileCode, colorClass: 'text-slate-400' },
  'dapp-pentest': { label: 'dApp Unit', icon: Globe, colorClass: 'text-emerald-500' },
  'library-audit': { label: 'Library Ops', icon: Package, colorClass: 'text-amber-500' }
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; colorClass: string }> = {
  'draft': { label: 'DRAFT', colorClass: 'text-slate-400 bg-slate-100 border-slate-200' },
  'configured': { label: 'CONFIGURED', colorClass: 'text-blue-600 bg-blue-50 border-blue-100' },
  'awaiting-preaudit': { label: 'AWAITING', colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
  'auditing': { label: 'AUDITING', colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100 animate-pulse' },
  'completed': { label: 'COMPLETED', colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
}

export default function Dashboard({ onViewAudit, onNewAudit }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Registry...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 animate-reveal">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-indigo-100">
              <Sparkles size={10} className="fill-white" />
              Sovereign Node Active
            </div>
            <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest leading-none border-l border-slate-200 pl-3">ID_CORE_{Math.random().toString(16).slice(2, 8).toUpperCase()}</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
            System <span className="text-indigo-600">Active.</span>
          </h1>
          <p className="text-slate-400 font-medium text-[13px] mt-4 max-w-xl leading-relaxed">
            Welcome back, <span className="text-slate-900 font-bold">{user?.displayName?.split(' ')[0] || 'Operator'}</span>. Your protocol infrastructure is reporting <span className="text-slate-900 font-bold">{projects.length} monitored units</span>.
          </p>
        </div>
        {projects.length > 0 && (
          <button
            onClick={onNewAudit}
            className="btn-primary group h-12 px-8"
          >
            <Plus size={16} />
            Deploy New Audit
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="card-premium relative overflow-hidden flex flex-col items-center justify-center text-center py-24">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
            <Shield size={300} strokeWidth={1} />
          </div>

          <div className="relative z-10 max-w-sm w-full flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8 border border-black/[0.03] shadow-inner">
              <Terminal size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">Registry Standby</h2>
            <p className="text-slate-400 font-medium leading-relaxed mb-10 text-[14px]">
              No protocol units currently localized. Initialize your first security node to proceed with neural auditing.
            </p>
            <button
              onClick={onNewAudit}
              className="btn-primary w-full h-12 shadow-2xl shadow-indigo-100"
            >
              <Plus size={16} />
              Deploy Initial Node
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onViewAudit(project.slug)}
              className="card-premium group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-12">
                <div className={`w-16 h-16 rounded-[24px] bg-slate-50 border border-black/[0.02] flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-2xl group-hover:shadow-indigo-200`}>
                  {project.type && PROJECT_TYPE_CONFIG[project.type] ? (
                    <div className={PROJECT_TYPE_CONFIG[project.type].colorClass}>
                      {(() => {
                        const Icon = PROJECT_TYPE_CONFIG[project.type].icon
                        return <Icon size={28} strokeWidth={2} className="group-hover:text-white transition-colors" />
                      })()}
                    </div>
                  ) : (
                    <Shield size={28} strokeWidth={2} className="text-slate-400 group-hover:text-white" />
                  )}
                </div>
                <div className={`px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${STATUS_CONFIG[project.status]?.colorClass || 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                  {STATUS_CONFIG[project.status]?.label || project.status}
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3 group-hover:text-indigo-600 transition-colors">
                {project.name}
              </h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-3">
                <span className="text-indigo-600/40">#</span> {project.category || 'Infrastructure'}
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                {project.componentCount} Units
              </p>

              <div className="pt-10 border-t border-black/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                    <ShieldCheck size={18} strokeWidth={3} />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1.5">Health Grade</div>
                    <div className="text-lg font-black text-slate-900 leading-none">
                      {project.aggregatedScore?.value || 0}% <span className="text-emerald-500 ml-1">{project.aggregatedScore?.grade || 'A'}</span>
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ArrowRight size={18} strokeWidth={3} />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={onNewAudit}
            className="group card-premium !bg-transparent border-4 border-dashed border-slate-100 hover:border-indigo-200 flex flex-col items-center justify-center text-center gap-6 transition-all hover:bg-white min-h-[300px]"
          >
            <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-2xl group-hover:shadow-indigo-200 transition-all">
              <Plus size={32} strokeWidth={3} />
            </div>
            <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-all">Initialize_New_Node</div>
          </button>
        </div>
      )}
    </div>
  )
}
