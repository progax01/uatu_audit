import { useParams } from 'react-router-dom'
import {
    Shield, Activity, Clock, ExternalLink,
    ChevronRight, Github, GitCommit, AlertTriangle
} from 'lucide-react'

export default function ProjectDetails() {
    const { slug } = useParams()

    // Mock data for the repository/project view
    const project = {
        name: slug?.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') || 'Protocol Node',
        status: 'Operational',
        health: 98,
        lastAudit: '2025-11-20',
        repo: 'https://github.com/uatu/core',
        branch: 'main',
        commit: '7a2f9b1',
        analysis: {
            critical: 0,
            high: 0,
            medium: 2,
            low: 14
        },
        timeline: [
            { id: 1, type: 'audit', event: 'Full Security Audit Completed', date: '2025-11-20', score: 98 },
            { id: 2, type: 'commit', event: 'Merged PR #82: Optimize Storage Access', date: '2025-11-19', author: '0xSovereign' },
            { id: 3, type: 'alert', event: 'Potential Reentrancy Pattern Detected (Mitigated)', date: '2025-11-18', level: 'Medium' }
        ]
    }

    return (
        <div className="space-y-10">


            {/* Hero */}
            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {project.status}
                        </div>
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Node ID: {slug?.toUpperCase()}</div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">{project.name}</h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-2xl font-black text-slate-900 leading-none mb-1">{project.health}%</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Health Score</div>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                        <Shield size={32} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Stats */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-3 gap-6">
                        <div className="card-premium !p-8 bg-white border-black/[0.03]">
                            <div className="flex items-center gap-3 mb-6 text-slate-300">
                                <Github size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Source Repo</span>
                            </div>
                            <div className="text-sm font-black text-slate-900 truncate mb-1">uatu / core</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                {project.branch} <div className="w-1 h-1 rounded-full bg-slate-200" /> {project.commit}
                            </div>
                        </div>

                        <div className="card-premium !p-8 bg-white border-black/[0.03]">
                            <div className="flex items-center gap-3 mb-6 text-slate-300">
                                <Activity size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Recent Activity</span>
                            </div>
                            <div className="text-sm font-black text-slate-900 mb-1">12 Pull Requests</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Last scan: {project.lastAudit}
                            </div>
                        </div>

                        <div className="card-premium !p-8 bg-white border-black/[0.03]">
                            <div className="flex items-center gap-3 mb-6 text-slate-300">
                                <AlertTriangle size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Mitigation Log</span>
                            </div>
                            <div className="text-sm font-black text-slate-900 mb-1">0 Open Risks</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                100% Remediation Rate
                            </div>
                        </div>
                    </div>

                    {/* Activity Timeline */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Security Timeline</h2>
                        <div className="space-y-3">
                            {project.timeline.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-6 bg-white rounded-[24px] border border-black/[0.02] hover:border-indigo-100 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'audit' ? 'bg-indigo-50 text-indigo-600' :
                                            item.type === 'alert' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
                                            }`}>
                                            {item.type === 'audit' ? <Shield size={18} /> :
                                                item.type === 'alert' ? <AlertTriangle size={18} /> : <GitCommit size={18} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-slate-900 tracking-tight">{item.event}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.date}</div>
                                        </div>
                                    </div>
                                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100">
                                        <ExternalLink size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Intelligence / Call to Action */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="card-premium !bg-white !p-8 border-black/[0.03] space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Protocol Vitals</h3>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        <div className="space-y-6">
                            {[
                                { label: 'Critical Paths', value: '0', color: 'text-rose-500' },
                                { label: 'Active Monitors', value: '42', color: 'text-indigo-600' },
                                { label: 'Bytecode Match', value: '100%', color: 'text-emerald-500' }
                            ].map(vital => (
                                <div key={vital.label} className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{vital.label}</span>
                                    <span className={`text-sm font-black ${vital.color}`}>{vital.value}</span>
                                </div>
                            ))}
                        </div>

                        <button className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 group">
                            Initiate Deep Scan
                            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="p-8 bg-indigo-600 rounded-[32px] text-white space-y-4">
                        <Clock size={24} className="opacity-50" />
                        <h4 className="text-lg font-black tracking-tight leading-tight">Continuous Monitoring Active</h4>
                        <p className="text-[11px] font-medium leading-relaxed opacity-80">This node is protected by Uatu's global security layer. All commits are being audited in near real-time.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
