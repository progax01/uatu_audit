import { useState, useEffect } from 'react'
import { Terminal, Plus, ChevronRight, Search, Cpu, Globe, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { authFetch } from '../services/authService'

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
    aggregatedScore?: {
        value: number
        grade: string
    }
}

const TYPE_MAP: Record<ProjectType, string> = {
    'full': 'Full Protocol',
    'contract-only': 'Smart Contracts',
    'dapp-pentest': 'dApp Frontend',
    'library-audit': 'Components'
}

const STATUS_MAP: Record<ProjectStatus, { label: string; color: string }> = {
    'draft': { label: 'Draft', color: 'text-slate-400 bg-slate-50 border-slate-200' },
    'configured': { label: 'Active', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    'awaiting-preaudit': { label: 'Awaiting', color: 'text-amber-600 bg-amber-50 border-amber-100' },
    'auditing': { label: 'Scanning', color: 'text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse' },
    'completed': { label: 'Operational', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
}

function getTimeAgo(date?: string): string {
    if (!date) return 'Never'
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function Nodes() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        const fetchProjects = async () => {
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
                        aggregatedScore: p.aggregatedScore,
                    }))
                    setProjects(transformedProjects)
                }
            } catch (err) {
                console.error('Failed to fetch projects:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchProjects()
    }, [])

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-10 animate-reveal">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Terminal size={10} className="fill-indigo-600" />
                            Protocol Registry
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Deployed <span className="text-indigo-600">Nodes</span></h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Manage your decentralized infrastructure nodes and monitor their real-time security integrity.
                    </p>
                </div>
                <Link to="/create-project" className={`btn-primary h-12 px-8 ${projects.length === 0 ? 'hidden' : ''}`}>
                    <Plus size={16} />
                    Deploy New Node
                </Link>
            </div>

            {projects.length > 0 && (
                <div className="relative group">
                    <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Node ID, Name or Component..."
                        className="w-full h-14 pl-16 pr-8 bg-white border border-black/[0.03] rounded-2xl font-black text-[12px] uppercase tracking-widest focus:outline-none focus:border-indigo-600/20 transition-all placeholder:text-slate-300 shadow-xl shadow-slate-100/30"
                    />
                </div>
            )}

            {loading && (
                <div className="grid grid-cols-1 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-white animate-pulse rounded-[40px] border border-black/[0.03]" />
                    ))}
                </div>
            )}

            {!loading && projects.length === 0 && (
                <div className="card-premium relative overflow-hidden flex flex-col items-center justify-center text-center py-24">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Terminal size={300} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 max-w-sm w-full flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8 border border-black/[0.03] shadow-inner">
                            <Cpu size={32} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">Registry Standby</h2>
                        <p className="text-slate-400 font-medium leading-relaxed mb-10 text-[14px]">
                            You haven't deployed any protocol nodes yet. Deploy your first unit to start monitoring.
                        </p>
                        <Link to="/create-project" className="btn-primary w-full h-12 shadow-2xl shadow-indigo-100">
                            <Plus size={16} />
                            Deploy Initial Node
                        </Link>
                    </div>
                </div>
            )}

            {!loading && filteredProjects.length > 0 && (
                <div className="grid grid-cols-1 gap-8">
                    {filteredProjects.map((project, idx) => {
                        const statusConfig = STATUS_MAP[project.status] || STATUS_MAP['draft']
                        const typeLabel = TYPE_MAP[project.type] || 'Protocol Unit'
                        const health = project.aggregatedScore?.value || 0

                        return (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Link
                                    to={`/project/${project.slug}`}
                                    className="card-premium group !p-8 flex items-center justify-between !rounded-[40px]"
                                >
                                    <div className="flex items-center gap-10">
                                        <div className="w-16 h-16 rounded-[24px] bg-slate-900 flex items-center justify-center text-white shadow-2xl group-hover:bg-indigo-600 transition-all duration-500">
                                            <Cpu size={28} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-4 mb-2">
                                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h3>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
                                                    {project.slug}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span className="flex items-center gap-2"><Globe size={14} className="text-slate-300" /> {typeLabel}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                <span className="flex items-center gap-2"><Activity size={14} className="text-slate-300" /> {project.componentCount} Components</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-12">
                                        {project.aggregatedScore ? (
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Capacity Score</div>
                                                <div className="flex items-center justify-end gap-5">
                                                    <div className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter leading-none">{health}%</div>
                                                    <div className="w-1.5 h-10 bg-slate-50 rounded-full overflow-hidden border border-black/[0.02]">
                                                        <div
                                                            className={`w-full transition-all duration-1000 ${health > 90 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : health > 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                            style={{ height: `${health}%`, marginTop: `${100 - health}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Last Interaction</div>
                                                <div className="text-sm font-bold text-slate-600">{getTimeAgo(project.lastAuditAt)}</div>
                                            </div>
                                        )}
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">PULSE_GEN_2H_AGO</span>
                                        </div>
                                        <div className="w-14 h-14 rounded-[20px] bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-2xl transition-all duration-500">
                                            <ChevronRight size={24} strokeWidth={3} />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {!loading && projects.length > 0 && filteredProjects.length === 0 && (
                <div className="text-center py-24 card-premium">
                    <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest">No nodes match "{searchQuery}"</p>
                </div>
            )}
        </div>
    )
}



