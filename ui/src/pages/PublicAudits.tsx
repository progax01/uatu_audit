import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Shield, Search, Calendar, Filter, Globe, Activity, ArrowRight,
    Zap, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'
import { supportedChains } from '../components/icons/CryptoIcons'

interface PublicAudit {
    id: string
    legacyId: number
    auditType: 'quick' | 'full'
    contractAddress: string | null
    network: string | null
    contractName: string | null
    isProxy: boolean
    repo: string
    createdAt: string
    completedAt: string | null
    score: number | null
    grade: string | null
    summary: string | null
}

interface Pagination {
    page: number
    limit: number
    total: number
    hasMore: boolean
    totalPages: number
}

interface Stats {
    totalAudits: number
    quickScans: number
    fullAudits: number
    avgScore: number
}

export default function PublicAudits() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    const [audits, setAudits] = useState<PublicAudit[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)

    const page = parseInt(searchParams.get('page') || '1')

    // Fetch stats on mount
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/public-audits/stats')
                const data = await response.json()
                if (data.ok) {
                    setStats(data.stats)
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err)
            }
        }
        fetchStats()
    }, [])

    // Fetch audits when page/filters change
    useEffect(() => {
        const fetchAudits = async () => {
            setLoading(true)
            setError(null)
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: '10',
                })
                if (selectedNetwork) params.set('network', selectedNetwork)
                if (searchTerm) params.set('search', searchTerm)

                const response = await fetch(`/api/public-audits?${params}`)
                const data = await response.json()

                if (data.ok) {
                    setAudits(data.audits)
                    setPagination(data.pagination)
                } else {
                    setError(data.error || 'Failed to fetch audits')
                }
            } catch (err) {
                console.error('Failed to fetch audits:', err)
                setError('Failed to connect to server')
            } finally {
                setLoading(false)
            }
        }

        fetchAudits()
    }, [page, selectedNetwork, searchTerm])

    const handlePageChange = (newPage: number) => {
        setSearchParams({ page: String(newPage) })
    }

    const handleSearch = (value: string) => {
        setSearchTerm(value)
        setSearchParams({ page: '1' }) // Reset to page 1 on search
    }

    // Get display name from audit
    const getDisplayName = (audit: PublicAudit) => {
        if (audit.contractName) return audit.contractName
        if (audit.repo.startsWith('scan://')) {
            const parts = audit.repo.split('/')
            return parts[parts.length - 1].slice(0, 10) + '...'
        }
        return audit.repo
    }

    // Get address display
    const getAddressDisplay = (audit: PublicAudit) => {
        if (audit.contractAddress) {
            return `${audit.contractAddress.slice(0, 6)}...${audit.contractAddress.slice(-4)}`
        }
        return audit.id.slice(0, 8)
    }

    // Format date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toISOString().split('T')[0]
    }

    // Get status based on score
    const getStatus = (score: number | null) => {
        if (score === null) return { label: 'Pending', color: 'amber' }
        if (score >= 90) return { label: 'Secure', color: 'emerald' }
        if (score >= 70) return { label: 'Review Needed', color: 'amber' }
        return { label: 'At Risk', color: 'red' }
    }

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
                            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                                {stats ? stats.totalAudits.toLocaleString() : '-'}
                            </div>
                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Reports Indexed</div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-3xl font-black text-emerald-600 tracking-tight leading-none">
                                {stats ? `${stats.avgScore}%` : '-'}
                            </div>
                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Avg Score</div>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Console */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-8 px-6">
                    <div className="flex-1 relative w-full">
                        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Filter by Protocol, Network, or Contract Address..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
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
                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <Loader2 size={32} className="animate-spin text-indigo-500" />
                            <span className="ml-4 text-sm text-slate-400">Loading audits...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-32">
                            <Shield size={48} className="text-slate-200 mb-4" />
                            <p className="text-sm text-slate-400">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-6 py-2 bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                            >
                                Retry
                            </button>
                        </div>
                    ) : audits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32">
                            <Shield size={48} className="text-slate-200 mb-4" />
                            <p className="text-sm text-slate-400">No public audits found</p>
                            <Link to="/quick-scan" className="mt-4 text-indigo-500 text-xs font-semibold hover:underline">
                                Run your first quick scan →
                            </Link>
                        </div>
                    ) : (
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
                                {audits.map((audit) => {
                                    const chain = supportedChains.find(c => c.name === audit.network)
                                    const status = getStatus(audit.score)
                                    return (
                                        <tr key={audit.id} className="group hover:bg-slate-50/30 transition-colors">
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 rounded-[20px] bg-indigo-50 border border-black/[0.03] flex items-center justify-center relative overflow-hidden group-hover:border-indigo-100/50 transition-colors">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent" />
                                                        <Zap size={24} className="relative z-10 text-indigo-500 group-hover:scale-110 transition-transform duration-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[15px] font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                                                            {getDisplayName(audit)}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                                                                {audit.auditType === 'quick' ? 'QUICK' : 'FULL'}
                                                            </div>
                                                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                            <div className="text-[9px] font-mono text-slate-400 truncate max-w-[200px] leading-none tracking-tight">
                                                                {getAddressDisplay(audit)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                {audit.network ? (
                                                    <div
                                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-sm bg-white"
                                                        style={{
                                                            borderColor: `${chain?.color}15`,
                                                            color: chain?.color || '#64748b'
                                                        }}
                                                    >
                                                        {chain && (
                                                            <chain.icon size={14} color={chain.color} />
                                                        )}
                                                        {audit.network}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden p-[1px] border border-black/[0.03]">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000"
                                                            style={{
                                                                width: `${audit.score || 0}%`,
                                                                background: (audit.score || 0) > 90
                                                                    ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                                                                    : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900 tracking-tight">
                                                        {audit.score !== null ? `${audit.score}%` : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                    <Calendar size={13} strokeWidth={2.5} />
                                                    {formatDate(audit.completedAt)}
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                                                        status.color === 'emerald'
                                                            ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                                            : status.color === 'amber'
                                                                ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                                                : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                                                    }`} />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                                                        {status.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <button
                                                    onClick={() => navigate(`/audit/${audit.id}`)}
                                                    className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-slate-900 text-white rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/5 hover:shadow-indigo-500/20 group/btn"
                                                >
                                                    View Report
                                                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {pagination && pagination.total > 0 && (
                    <div className="mt-16 flex items-center justify-between px-8">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} security reports
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1}
                                className="w-12 h-12 rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-black/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            {/* Page numbers */}
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let pageNum: number
                                if (pagination.totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (page <= 3) {
                                    pageNum = i + 1
                                } else if (page >= pagination.totalPages - 2) {
                                    pageNum = pagination.totalPages - 4 + i
                                } else {
                                    pageNum = page - 2 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-[11px] font-black transition-all ${
                                            pageNum === page
                                                ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                                                : 'text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-black/[0.05]'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}

                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={!pagination.hasMore}
                                className="w-12 h-12 rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-black/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
