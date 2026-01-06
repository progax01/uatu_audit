import { useState } from 'react'
import { Shield, Search, Calendar, Filter, Globe, Activity, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'
import { supportedChains } from '../components/icons/CryptoIcons'

const publicReports = [
    { id: 'QA-29381', name: 'Uniswap V3 Factory', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', network: 'Ethereum', score: 98, date: '2025-05-12', status: 'Secure', category: 'DEX' },
    { id: 'QA-29382', name: 'Aave V3 Reserve', address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', network: 'Arbitrum', score: 96, date: '2025-05-11', status: 'Secure', category: 'Lending' },
    { id: 'QA-29383', name: 'Curve Tricrypto', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', network: 'Ethereum', score: 92, date: '2025-05-10', status: 'Review Needed', category: 'AMM' },
    { id: 'QA-29384', name: 'Lido stETH Proxy', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', network: 'Ethereum', score: 99, date: '2025-05-09', status: 'Secure', category: 'Staking' },
    { id: 'QA-29385', name: 'GMX Vault v2', address: '0x489ee077994B6658eAfA855C308275EAd8097C4A', network: 'Arbitrum', score: 94, date: '2025-05-08', status: 'Secure', category: 'Derivatives' },
    { id: 'QA-29386', name: 'Stargate Bridge', address: '0x231B05877543da787E7BC8AdCC55Ab492e8609DE', network: 'Base', score: 88, date: '2025-05-07', status: 'Mitigated', category: 'Bridge' },
]

export default function PublicAudits() {
    const [searchTerm, setSearchTerm] = useState('')

    return (
        <div className="min-h-screen bg-white selection:bg-indigo-500/10 flex flex-col font-sans">
            <MouseTooltip />

            {/* Sticky Full-Width Header */}
            <header className="sticky top-0 h-20 bg-white/80 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between px-10 shrink-0 z-[100]">
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center">
                        <img src={logo} alt="Uatu" className="h-8" />
                    </Link>
                    <div className="h-4 w-[1px] bg-black/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Security Transparency Layer</span>
                </div>
                <div className="flex items-center gap-8">
                    <Link to="/quick-scan" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Analyzer Console</Link>
                    <Link to="/dashboard" className="btn-primary !py-2.5 !px-8 !text-[10px]">Launch Console</Link>
                </div>
            </header>

            <main className="flex-1 w-full px-10 py-10 bg-slate-50/30">
                {/* Hero / Info Area */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10 px-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <Globe size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">Global Protocol Directory</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter mb-3 leading-tight">Public Security <br />Ledger.</h1>
                        <p className="text-[13px] text-slate-400 font-medium leading-relaxed max-w-lg">
                            Institutional-grade audit data for the multi-chain ecosystem. Real-time security state for verified decentralized protocols.
                        </p>
                    </div>

                    <div className="flex items-center gap-12 border-l border-black/[0.03] pl-10 h-20">
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">12.4K</div>
                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Reports Indexed</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-black text-emerald-600 tracking-tight leading-none">100%</div>
                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Node Availability</div>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Console */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-8 px-6">
                    <div className="flex-1 relative w-full">
                        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Filter by Protocol, Network, or Audit ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-black/[0.03] p-6 pl-16 rounded-[24px] text-xs font-semibold focus:outline-none focus:border-indigo-500/30 focus:shadow-2xl focus:shadow-indigo-500/5 transition-all text-slate-900 placeholder:text-slate-200"
                        />
                    </div>
                    <button className="flex items-center gap-3 px-10 py-6 bg-white border border-black/[0.03] rounded-[24px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-black/[0.1] transition-all shadow-sm">
                        <Filter size={14} />
                        Filter Parameters
                    </button>
                    <button className="flex items-center gap-3 px-10 py-6 bg-white border border-black/[0.03] rounded-[24px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-black/[0.1] transition-all shadow-sm whitespace-nowrap">
                        <Activity size={14} />
                        Network Stats
                    </button>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-[40px] border border-black/[0.03] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.03)] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black/[0.03] bg-slate-50/50">
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Protocol Identity</th>
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Deployment</th>
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Security Score</th>
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Audit Date</th>
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Status</th>
                                <th className="px-10 py-10 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Artifact</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.02]">
                            {publicReports.map((report) => {
                                const chain = supportedChains.find(c => c.name === report.network);
                                return (
                                    <tr key={report.id} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-10 py-10">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-[20px] bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300 relative overflow-hidden group-hover:border-indigo-100/50 transition-colors">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
                                                    <Shield size={24} className="relative z-10 group-hover:text-indigo-600 transition-colors duration-500" />
                                                </div>
                                                <div>
                                                    <div className="text-[15px] font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">{report.name}</div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">{report.id}</div>
                                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                        <div className="text-[9px] font-mono text-slate-400 truncate max-w-[200px] leading-none tracking-tight">{report.address}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <div
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-sm bg-white"
                                                style={{
                                                    borderColor: `${chain?.color}15`,
                                                    color: chain?.color
                                                }}
                                            >
                                                {chain && (
                                                    <chain.icon size={14} color={chain.color} />
                                                )}
                                                {report.network}
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <div className="flex items-center gap-5">
                                                <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden p-[1px] border border-black/[0.03]">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000"
                                                        style={{
                                                            width: `${report.score}%`,
                                                            background: report.score > 90
                                                                ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                                                                : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm font-black text-slate-900 tracking-tight">{report.score}%</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                <Calendar size={13} strokeWidth={2.5} />
                                                {report.date}
                                            </div>
                                        </td>
                                        <td className="px-10 py-10">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-2 h-2 rounded-full animate-pulse ${report.status === 'Secure' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'}`} />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{report.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-10 text-right">
                                            <button className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-slate-900 text-white rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/5 hover:shadow-indigo-500/20 group/btn">
                                                View Report
                                                <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="mt-16 flex items-center justify-between px-8">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Showing 1-10 of 12,432 security reports</p>
                    <div className="flex items-center gap-3">
                        {[1, 2, 3, '...', 1243].map((p, i) => (
                            <button
                                key={i}
                                className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-[11px] font-black transition-all ${p === 1 ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20' : 'text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-black/[0.05]'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
