import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Shield, Search, Calendar, Globe, ArrowRight,
    Zap, ChevronLeft, ChevronRight, Loader2, Menu, X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'
import { supportedChains } from '../components/icons/CryptoIcons'
import SEO, { pageSEO } from '../components/SEO'

type AuditStatus = 'pending' | 'queued' | 'analyzing' | 'auditing' | 'generating' | 'completed' | 'failed'

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
    status: AuditStatus
    progressPct: number
    progressMessage: string | null
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
    queuedCount: number
    inProgressCount: number
}

export default function PublicAudits() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    const [audits, setAudits] = useState<PublicAudit[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const page = parseInt(searchParams.get('page') || '1')

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput)
            if (searchInput !== debouncedSearch) {
                setSearchParams({ page: '1' }) // Reset to page 1 on search change
            }
        }, 400) // 400ms debounce

        return () => clearTimeout(timer)
    }, [searchInput])

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
                    includeInProgress: 'true',
                })
                if (selectedNetwork) params.set('network', selectedNetwork)
                if (debouncedSearch) params.set('search', debouncedSearch)

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
    }, [page, selectedNetwork, debouncedSearch])

    const handlePageChange = (newPage: number) => {
        setSearchParams({ page: String(newPage) })
    }

    const getDisplayName = (audit: PublicAudit) => {
        if (audit.contractName) return audit.contractName
        if (audit.repo.startsWith('scan://')) {
            const parts = audit.repo.split('/')
            return parts[parts.length - 1].slice(0, 10) + '...'
        }
        return audit.repo
    }

    const getAddressDisplay = (audit: PublicAudit) => {
        if (audit.contractAddress) {
            return `${audit.contractAddress.slice(0, 6)}...${audit.contractAddress.slice(-4)}`
        }
        return audit.id.slice(0, 8)
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toISOString().split('T')[0]
    }

    const getStatus = (audit: PublicAudit) => {
        switch (audit.status) {
            case 'queued':
                return { label: 'Queued', color: 'slate', isInProgress: true }
            case 'pending':
                return { label: 'Pending', color: 'amber', isInProgress: true }
            case 'analyzing':
                return { label: 'Analyzing', color: 'indigo', isInProgress: true }
            case 'auditing':
                return { label: 'Auditing', color: 'indigo', isInProgress: true }
            case 'generating':
                return { label: 'Generating', color: 'indigo', isInProgress: true }
            case 'failed':
                return { label: 'Failed', color: 'red', isInProgress: false }
            case 'completed':
            default:
                if (audit.score === null) return { label: 'N/A', color: 'slate', isInProgress: false }
                if (audit.score >= 90) return { label: 'Secure', color: 'emerald', isInProgress: false }
                if (audit.score >= 70) return { label: 'Review Needed', color: 'amber', isInProgress: false }
                return { label: 'At Risk', color: 'red', isInProgress: false }
        }
    }

    // Get score bar color based on score
    const getScoreColor = (score: number | null, isInProgress: boolean) => {
        if (isInProgress) return 'linear-gradient(90deg, #6366f1, #a855f7)'
        if (!score) return 'linear-gradient(90deg, #94a3b8, #94a3b8)'
        if (score >= 90) return 'linear-gradient(90deg, #10b981, #059669)'
        if (score >= 70) return 'linear-gradient(90deg, #f59e0b, #d97706)'
        return 'linear-gradient(90deg, #ef4444, #dc2626)'
    }

    return (
        <>
            <SEO
                title={pageSEO.publicAudits.title}
                description={pageSEO.publicAudits.description}
                keywords={pageSEO.publicAudits.keywords}
                url="https://uatu.xyz/public-audits"
            />
            <div className="min-h-screen bg-white dark:bg-slate-950 selection:bg-indigo-500/10 flex flex-col font-sans transition-colors duration-300">
                <MouseTooltip />

                {/* Header - Responsive */}
                <header className="sticky top-0 h-16 lg:h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-black/[0.03] dark:border-white/[0.05] flex items-center justify-between px-4 lg:px-10 shrink-0 z-[100]">
                    <div className="flex items-center gap-3 lg:gap-6">
                        <Link to="/" className="flex items-center">
                            <img src={logo} alt="Uatu" className="h-7 lg:h-8" />
                        </Link>
                        <div className="hidden sm:block h-4 w-[1px] bg-black/10 dark:bg-white/10" />
                        <span className="hidden sm:block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] text-slate-400">Security Transparency Layer</span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-4 lg:gap-8">
                        <Link to="/quick-scan" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Analyzer Console</Link>
                        <Link to="/dashboard" className="btn-primary !py-2 lg:!py-2.5 !px-5 lg:!px-8 !text-[9px] lg:!text-[10px]">Launch Console</Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-slate-900 dark:text-white"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </header>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden fixed inset-x-0 top-16 bg-white dark:bg-slate-900 border-b border-black/[0.04] dark:border-white/[0.05] shadow-2xl z-50 p-4">
                        <nav className="flex flex-col gap-4">
                            <Link
                                to="/quick-scan"
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest"
                            >
                                Analyzer Console
                            </Link>
                            <Link
                                to="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className="btn-primary w-full"
                            >
                                Launch Console
                            </Link>
                        </nav>
                    </div>
                )}

                <main className="flex-1 w-full px-4 lg:px-10 py-6 lg:py-10 bg-slate-50/30 dark:bg-slate-950">
                    {/* Hero / Info Area - Responsive */}
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-8 mb-6 lg:mb-10 px-2 lg:px-6">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-2 mb-3 lg:mb-4">
                                <Globe size={14} className="text-indigo-600 dark:text-indigo-400" />
                                <span className="text-[9px] lg:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Global Protocol Directory</span>
                            </div>
                            <h1 className="text-2xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2 lg:mb-3 leading-tight">Public Security Ledger.</h1>
                            <p className="text-[11px] lg:text-[13px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed max-w-lg">
                                Institutional-grade audit data for the multi-chain ecosystem. Real-time security state for verified decentralized protocols.
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap items-center gap-6 lg:gap-12 border-l border-black/[0.03] dark:border-white/[0.05] pl-6 lg:pl-10 h-fit">
                            <div className="flex flex-col gap-1">
                                <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                    {stats ? stats.totalAudits.toLocaleString() : '-'}
                                </div>
                                <div className="text-[8px] lg:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Reports Indexed</div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="text-2xl lg:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight leading-none">
                                    {supportedChains.length}+
                                </div>
                                <div className="text-[8px] lg:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Chains Supported</div>
                            </div>
                            {stats && (stats.queuedCount > 0 || stats.inProgressCount > 0) && (
                                <div className="flex flex-col gap-1">
                                    <div className="text-2xl lg:text-3xl font-black text-amber-500 tracking-tight leading-none flex items-center gap-2">
                                        {stats.queuedCount + stats.inProgressCount}
                                        <Loader2 size={16} className="animate-spin" />
                                    </div>
                                    <div className="text-[8px] lg:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                                        {stats.queuedCount > 0 ? `${stats.queuedCount} Queued` : ''}
                                        {stats.queuedCount > 0 && stats.inProgressCount > 0 ? ' / ' : ''}
                                        {stats.inProgressCount > 0 ? `${stats.inProgressCount} Active` : ''}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Search Box */}
                    <div className="mb-6 lg:mb-8 px-2 lg:px-6">
                        <div className="relative w-full">
                            <Search size={16} className="absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                type="text"
                                placeholder="Search by protocol, network, or contract address..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-black/[0.03] dark:border-white/[0.05] p-4 lg:p-5 pl-12 lg:pl-14 rounded-2xl lg:rounded-[20px] text-sm font-medium focus:outline-none focus:border-indigo-500/30 focus:shadow-xl focus:shadow-indigo-500/5 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            />
                            {searchInput && debouncedSearch !== searchInput && (
                                <div className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2">
                                    <Loader2 size={14} className="animate-spin text-slate-300" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Data Display - Responsive */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-[40px] border border-black/[0.03] dark:border-white/[0.05] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.03)] overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 lg:py-32">
                                <Loader2 size={28} className="animate-spin text-indigo-500" />
                                <span className="ml-4 text-sm text-slate-400">Loading audits...</span>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-20 lg:py-32 px-4">
                                <Shield size={40} className="text-slate-200 dark:text-slate-700 mb-4" />
                                <p className="text-sm text-slate-400 text-center">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-4 px-6 py-2 bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : audits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 lg:py-32 px-4">
                                <Shield size={40} className="text-slate-200 dark:text-slate-700 mb-4" />
                                <p className="text-sm text-slate-400 text-center">No public audits found</p>
                                <Link to="/quick-scan" className="mt-4 text-indigo-500 text-xs font-semibold hover:underline">
                                    Run your first quick scan →
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table - Hidden on mobile/tablet */}
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[900px]">
                                        <thead>
                                            <tr className="border-b border-black/[0.03] dark:border-white/[0.05] bg-slate-50/50 dark:bg-slate-800/50">
                                                <th className="px-8 py-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Protocol Identity</th>
                                                <th className="px-6 py-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Deployment</th>
                                                <th className="px-6 py-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Security Score</th>
                                                <th className="px-6 py-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Audit Date</th>
                                                <th className="px-8 py-8 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Artifact</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/[0.02] dark:divide-white/[0.02]">
                                            {audits.map((audit) => {
                                                const chain = supportedChains.find(c => c.name === audit.network)
                                                const status = getStatus(audit)
                                                return (
                                                    <tr key={audit.id} className="group hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-8 py-8">
                                                            <div className="flex items-center gap-5">
                                                                <div className={`w-12 h-12 rounded-2xl border border-black/[0.03] dark:border-white/[0.05] flex items-center justify-center relative overflow-hidden group-hover:border-indigo-100/50 transition-colors ${
                                                                    status.isInProgress ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-indigo-50 dark:bg-indigo-900/30'
                                                                }`}>
                                                                    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent dark:from-white/5" />
                                                                    {status.isInProgress ? (
                                                                        <Loader2 size={20} className="relative z-10 text-indigo-500 animate-spin" />
                                                                    ) : (
                                                                        <Zap size={20} className="relative z-10 text-indigo-500 group-hover:scale-110 transition-transform duration-500" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                                        {getDisplayName(audit)}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1.5">
                                                                        <div className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest leading-none">
                                                                            {audit.auditType === 'quick' ? 'QUICK' : 'FULL'}
                                                                        </div>
                                                                        <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                                        <div className="text-[9px] font-mono text-slate-400 truncate max-w-[140px] leading-none tracking-tight">
                                                                            {getAddressDisplay(audit)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-8">
                                                            {audit.network ? (
                                                                <div
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest shadow-sm bg-white dark:bg-slate-800"
                                                                    style={{
                                                                        borderColor: `${chain?.color}15`,
                                                                        color: chain?.color || '#64748b'
                                                                    }}
                                                                >
                                                                    {chain && (
                                                                        <chain.icon size={12} color={chain.color} />
                                                                    )}
                                                                    {audit.network}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-8">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden p-[1px] border border-black/[0.03] dark:border-white/[0.05]">
                                                                    <div
                                                                        className="h-full rounded-full transition-all duration-1000"
                                                                        style={{
                                                                            width: `${status.isInProgress ? (audit.progressPct || 10) : (audit.score || 0)}%`,
                                                                            background: getScoreColor(audit.score, status.isInProgress),
                                                                            animation: status.isInProgress ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight min-w-[40px]">
                                                                    {status.isInProgress
                                                                        ? `${audit.progressPct || 0}%`
                                                                        : audit.score !== null ? `${audit.score}%` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-8">
                                                            {status.isInProgress ? (
                                                                <div className="flex items-center gap-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">
                                                                    <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                                                                    {audit.progressMessage || status.label}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                                    <Calendar size={12} strokeWidth={2.5} />
                                                                    {formatDate(audit.completedAt)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-8 text-right">
                                                            {status.isInProgress ? (
                                                                <button
                                                                    onClick={() => navigate(`/audit/${audit.id}`)}
                                                                    className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                                                                >
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                    In Progress
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => navigate(`/audit/${audit.id}`)}
                                                                    className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/5 hover:shadow-indigo-500/20 group/btn"
                                                                >
                                                                    View Report
                                                                    <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile/Tablet Card View */}
                                <div className="lg:hidden divide-y divide-black/[0.03] dark:divide-white/[0.05]">
                                    {audits.map((audit) => {
                                        const chain = supportedChains.find(c => c.name === audit.network)
                                        const status = getStatus(audit)
                                        return (
                                            <div
                                                key={audit.id}
                                                className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/audit/${audit.id}`)}
                                            >
                                                {/* Top Row: Icon + Name + Network Badge */}
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className={`w-10 h-10 rounded-xl border border-black/[0.03] dark:border-white/[0.05] flex items-center justify-center shrink-0 ${
                                                        status.isInProgress ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-indigo-50 dark:bg-indigo-900/30'
                                                    }`}>
                                                        {status.isInProgress ? (
                                                            <Loader2 size={16} className="text-indigo-500 animate-spin" />
                                                        ) : (
                                                            <Zap size={16} className="text-indigo-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                                                            {getDisplayName(audit)}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                                                                {audit.auditType === 'quick' ? 'QUICK' : 'FULL'}
                                                            </span>
                                                            <span className="text-[8px] font-mono text-slate-400 truncate">
                                                                {getAddressDisplay(audit)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {audit.network && (
                                                        <div
                                                            className="px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 shrink-0"
                                                            style={{
                                                                borderColor: `${chain?.color}15`,
                                                                color: chain?.color || '#64748b'
                                                            }}
                                                        >
                                                            {audit.network}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Score Bar + Percentage */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-black/[0.03] dark:border-white/[0.05]">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-1000"
                                                            style={{
                                                                width: `${status.isInProgress ? (audit.progressPct || 10) : (audit.score || 0)}%`,
                                                                background: getScoreColor(audit.score, status.isInProgress),
                                                                animation: status.isInProgress ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight min-w-[40px]">
                                                        {status.isInProgress
                                                            ? `${audit.progressPct || 0}%`
                                                            : audit.score !== null ? `${audit.score}%` : 'N/A'
                                                        }
                                                    </span>
                                                </div>

                                                {/* Bottom Row: Date/Status + Action */}
                                                <div className="flex items-center justify-between">
                                                    {status.isInProgress ? (
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                                                            <Loader2 size={10} className="animate-spin" />
                                                            {audit.progressMessage || status.label}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                            <Calendar size={10} />
                                                            {formatDate(audit.completedAt)}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                        {status.isInProgress ? 'View Progress' : 'View Report'}
                                                        <ArrowRight size={10} />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Pagination - Responsive */}
                    {pagination && pagination.total > 0 && (
                        <div className="mt-8 lg:mt-16 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 lg:px-8">
                            <p className="text-[9px] lg:text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest text-center sm:text-left">
                                Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} reports
                            </p>
                            <div className="flex items-center gap-2 lg:gap-3">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1}
                                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-black/[0.05] dark:hover:border-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                {/* Page numbers - Show fewer on mobile */}
                                {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                                    let pageNum: number
                                    if (pagination.totalPages <= 3) {
                                        pageNum = i + 1
                                    } else if (page <= 2) {
                                        pageNum = i + 1
                                    } else if (page >= pagination.totalPages - 1) {
                                        pageNum = pagination.totalPages - 2 + i
                                    } else {
                                        pageNum = page - 1 + i
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-[18px] flex items-center justify-center text-[10px] lg:text-[11px] font-black transition-all ${
                                                pageNum === page
                                                    ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-2xl shadow-slate-900/20'
                                                    : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-black/[0.05] dark:hover:border-white/[0.05]'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}

                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={!pagination.hasMore}
                                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-[18px] flex items-center justify-center text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-black/[0.05] dark:hover:border-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    )
}
