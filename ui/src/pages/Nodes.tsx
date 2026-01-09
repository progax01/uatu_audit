import { Radar, Activity, Plus, ArrowUpRight, AlertTriangle, Search, BarChart3, ShieldAlert, Globe } from 'lucide-react'

export default function Nodes() {
    const watcherNodes = [
        {
            id: 'WN-01',
            name: 'PancakeSwap-V3-Mainnet',
            status: 'Observing',
            network: 'BNB Chain',
            scanned: '1.2M',
            alerts: 14,
            interval: '500ms',
            load: '12%'
        },
        {
            id: 'WN-02',
            name: 'PancakeSwap-V3-Base',
            status: 'Observing',
            network: 'Base',
            scanned: '840K',
            alerts: 3,
            interval: '1s',
            load: '8%'
        },
        {
            id: 'WN-03',
            name: 'PancakeSwap-V3-Eth',
            status: 'Standby',
            network: 'Ethereum',
            scanned: '0',
            alerts: 0,
            interval: '500ms',
            load: '0%'
        }
    ]

    const flaggedActivities = [
        {
            id: 1,
            event: 'Large LP Withdrawal',
            context: 'PancakeSwap V3 (WBNB/CAKE)',
            severity: 'High',
            time: '2m ago',
            details: '0x42...42 withdrawn $2.4M liquidity in single block.',
            status: 'Flagged'
        },
        {
            id: 2,
            event: 'Abnormal Slippage Swap',
            context: 'CAKE/USDT Path',
            severity: 'Medium',
            time: '15m ago',
            details: '15% slippage experienced on router call #9821.',
            status: 'Logged'
        },
        {
            id: 3,
            event: 'Frontend Hash Mismatch',
            context: 'pancakeswap.finance (CDN)',
            severity: 'Critical',
            time: '45m ago',
            details: 'Cloudfront edge node 0x82 reported index.js hash diff.',
            status: 'Alert Sent'
        },
        {
            id: 4,
            event: 'Unverified Router Call',
            context: 'Universal Router',
            severity: 'Low',
            time: '2h ago',
            details: 'Interaction with unverified implementation at 0x93...21.',
            status: 'Ignored'
        }
    ]

    return (
        <div className="space-y-10 animate-reveal">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Radar size={10} className="animate-pulse" />
                            Live Surveillance Mode
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Watcher <span className="text-indigo-600">Nodes</span></h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Deploy decentralized watchers to monitor on-chain transactions, frontend integrity, and contract state changes in real-time.
                    </p>
                </div>
                <button className="btn-primary h-12 px-8">
                    <Plus size={16} />
                    Deploy New Watcher
                </button>
            </div>

            {/* Watcher Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {watcherNodes.map((node) => (
                    <div key={node.id} className="card-premium group hover:border-indigo-600/20 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity -rotate-12 group-hover:rotate-0 duration-1000">
                            <Radar size={120} strokeWidth={1} />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner transition-all duration-500 ${node.status === 'Observing'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : 'bg-slate-50 text-slate-300 border-black/[0.03]'
                                    }`}>
                                    <Activity size={22} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{node.network}</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'Observing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${node.status === 'Observing' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {node.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-base font-black text-slate-900 tracking-tight uppercase mb-6 truncate">{node.name}</h3>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-black/[0.02]">
                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Scanned TXs</div>
                                    <div className="text-xl font-black text-slate-900 tracking-tighter">{node.scanned}</div>
                                </div>
                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-black/[0.02]">
                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Alerts Flagged</div>
                                    <div className="text-xl font-black text-indigo-600 tracking-tighter">{node.alerts}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-black/[0.03]">
                                <div className="flex items-center gap-2">
                                    <Search size={12} className="text-slate-300" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{node.interval} Interval</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={12} className="text-slate-300" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{node.load} Node Load</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Live Alerts Table */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                            <ShieldAlert size={16} />
                        </div>
                        <h2 className="text-sm font-black text-slate-900 tracking-widest uppercase">Flagged Protocol Activities</h2>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        <Globe size={12} />
                        Global Monitoring Active
                    </div>
                </div>

                <div className="card-premium overflow-hidden !p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-black/[0.03]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Event</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Context</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Severity</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Observation Registry</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.03]">
                                {flaggedActivities.map((alert) => (
                                    <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl bg-white border border-black/[0.03] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all ${alert.severity === 'Critical' ? 'text-rose-600 border-rose-100' :
                                                        alert.severity === 'High' ? 'text-amber-600 border-amber-100' : 'text-slate-300'
                                                    }`}>
                                                    <AlertTriangle size={18} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{alert.event}</div>
                                                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">{alert.details}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="text-xs font-black text-slate-600 uppercase tracking-tighter mb-1">{alert.context}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{alert.time}</div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${alert.severity === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    alert.severity === 'High' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        alert.severity === 'Medium' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                            'bg-slate-50 text-slate-400 border-black/[0.03]'
                                                }`}>
                                                {alert.severity}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{alert.status}</span>
                                                <button className="w-9 h-9 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-white hover:shadow-xl transition-all">
                                                    <ArrowUpRight size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    )
}
