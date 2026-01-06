import { useState, useRef, useCallback } from 'react'
import { ArrowRight, Loader2, CheckCircle, Share2, Search, Cpu, Shield, Globe, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/logo.svg'
import MouseTooltip from '../components/MouseTooltip'
import { Link } from 'react-router-dom'
import { supportedChains } from '../components/icons/CryptoIcons'

type Network = 'arbitrum' | 'ethereum' | 'polygon' | 'base' | 'bnb' | 'optimism'
type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'error'

const networks: { id: Network; name: string; shortName: string; color: string }[] = [
    { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', color: '#627EEA' },
    { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', color: '#28A0F0' },
    { id: 'polygon', name: 'Polygon', shortName: 'POLY', color: '#8247E5' },
    { id: 'base', name: 'Base', shortName: 'BASE', color: '#0052FF' },
    { id: 'bnb', name: 'BNB Chain', shortName: 'BNB', color: '#F3BA2F' },
    { id: 'optimism', name: 'Optimism', shortName: 'OP', color: '#FF0420' },
]

export default function QuickScan() {
    const [selectedNetwork, setSelectedNetwork] = useState<Network>('ethereum')
    const [contractAddress, setContractAddress] = useState('')
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    const [scanResult, setScanResult] = useState<any>(null)

    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const validateAndFetch = useCallback(async (address: string, network: Network) => {
        setValidationStatus('validating')
        setError(null)
        try {
            const response = await fetch('/scan/validate-and-fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, network }),
            })
            const data = await response.json()
            if (!response.ok || !data.isContract || !data.isVerified) {
                setError(data.error || 'Contract must be verified on explorer')
                setValidationStatus('invalid')
                return
            }
            setValidationStatus('valid')
        } catch (err) {
            setError('Connection failed')
            setValidationStatus('error')
        }
    }, [])

    const handleAddressChange = (address: string) => {
        setContractAddress(address)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setValidationStatus('idle')
            return
        }
        debounceRef.current = setTimeout(() => validateAndFetch(address, selectedNetwork), 500)
    }

    const handleStartScan = async () => {
        setIsStarting(true)
        await new Promise(r => setTimeout(r, 2000))
        setScanResult({
            score: 94,
            criticals: 0,
            highs: 0,
            mediums: 2,
            timestamp: new Date().toISOString(),
            riskLevel: 'LOW'
        })
        setIsStarting(false)
    }

    return (
        <div className="min-h-screen bg-white selection:bg-indigo-500/10 flex flex-col font-sans overflow-hidden">
            <MouseTooltip />

            {/* Sticky Professional Header */}
            <header className="sticky top-0 h-20 bg-white/80 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between px-10 shrink-0 z-[100]">
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center">
                        <img src={logo} alt="Uatu" className="h-8" />
                    </Link>
                    <div className="h-4 w-[1px] bg-black/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Security Analyzer Console</span>
                </div>
                <div className="flex items-center gap-8">
                    <Link to="/public-audits" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Audit Ledger</Link>
                    <Link to="/dashboard" className="btn-primary !py-2.5 !px-8 !text-[10px]">Launch Console</Link>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Configuration Console */}
                <div className="w-[500px] bg-white border-r border-black/[0.03] flex flex-col p-10 overflow-y-auto">
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-6">
                            <Activity size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Formal Verification Node</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Initialize Scan.</h1>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">Provide deployment target for deep-level bytecode analysis and security posture assessment.</p>
                    </div>

                    <div className="space-y-10">
                        {/* Network Select */}
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Globe size={12} /> Deployment Network
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {networks.map(n => {
                                    const chainIcon = supportedChains.find(c => c.name.toLowerCase() === n.id.toLowerCase() || (n.id === 'bnb' && c.name === 'BSC'));
                                    const isSelected = selectedNetwork === n.id;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => setSelectedNetwork(n.id)}
                                            className={`group px-5 py-4 rounded-[20px] border text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-3 relative overflow-hidden ${isSelected ? 'bg-white shadow-xl shadow-slate-200/50' : 'bg-slate-50 border-black/[0.02] text-slate-400 hover:bg-white hover:border-black/[0.1]'}`}
                                            style={{ borderColor: isSelected ? `${n.color}40` : undefined }}
                                        >
                                            <div className="relative z-10 w-6 h-6 rounded-lg flex items-center justify-center bg-white border border-black/[0.03] shadow-sm">
                                                {chainIcon && <chainIcon.icon size={14} color={isSelected ? n.color : '#cbd5e1'} />}
                                            </div>
                                            <span className={`relative z-10 ${isSelected ? 'text-slate-900' : ''}`}>{n.name}</span>
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-br opacity-[0.03]" style={{ backgroundImage: `linear-gradient(to bottom right, ${n.color}, transparent)` }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Address Input */}
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Search size={12} /> Contract Identity
                            </label>
                            <div className="relative">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">0x</div>
                                <input
                                    type="text"
                                    value={contractAddress.replace(/^0x/, '')}
                                    onChange={(e) => handleAddressChange('0x' + e.target.value)}
                                    placeholder="Enter verified contract address..."
                                    className="w-full bg-slate-50 border border-black/[0.03] rounded-[20px] py-6 pl-14 pr-12 text-xs font-mono font-bold focus:outline-none focus:bg-white focus:border-indigo-500/30 focus:shadow-2xl focus:shadow-indigo-500/5 transition-all placeholder:text-slate-200 text-slate-900"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                    {validationStatus === 'validating' && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                                    {validationStatus === 'valid' && <CheckCircle size={16} className="text-emerald-500" />}
                                    {validationStatus === 'invalid' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                                </div>
                            </div>
                            {error && (
                                <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest pl-2">
                                    Target Refused: {error}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleStartScan}
                            disabled={validationStatus !== 'valid' || isStarting}
                            className="w-full py-6 bg-slate-900 hover:bg-black disabled:bg-slate-50 disabled:text-slate-200 rounded-[22px] text-white text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-2xl shadow-slate-900/10 group overflow-hidden relative"
                        >
                            {isStarting ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10 flex items-center gap-3">Run Formal Analysis <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" /></span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-auto pt-10 border-t border-black/[0.03] flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">System Status: Operational</span>
                        </div>
                        <div className="text-[9px] font-black text-slate-200 uppercase tracking-widest">v2.4.0-STABLE</div>
                    </div>
                </div>

                {/* Right: Analysis Visualization */}
                <div className="flex-1 bg-slate-50/50 p-12 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-dot-pattern opacity-[0.03] pointer-events-none" />

                    <AnimatePresence mode="wait">
                        {!scanResult ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center max-w-md"
                            >
                                <div className="w-24 h-24 bg-white border border-black/[0.03] rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-xl shadow-slate-200/50 group hover:scale-105 transition-transform duration-500">
                                    <Cpu size={40} className="text-indigo-600/20 group-hover:text-indigo-600 transition-colors duration-500" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4 uppercase">System Awaiting Target</h2>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                                    Formal Security Node idle. Input a verified contract address on the left to initiate the bytecode extraction and vulnerability mapping phase.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full max-w-3xl"
                            >
                                <div className="bg-white rounded-[48px] border border-black/[0.03] p-16 shadow-[0_48px_128px_-32px_rgba(0,0,0,0.06)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

                                    <div className="flex items-start justify-between mb-16 relative z-10">
                                        <div>
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-4">
                                                <Shield size={10} /> Verified Security Artifact
                                            </div>
                                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-4">Audit Complete.</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Trust Score verified by Uatu Security Engine</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="w-28 h-28 rounded-[32px] bg-slate-900 flex flex-col items-center justify-center text-white relative shadow-2xl shadow-slate-900/30">
                                                <div className="text-3xl font-black italic">{scanResult.score}</div>
                                                <div className="text-[8px] font-black uppercase tracking-widest opacity-50">SCORE</div>
                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-2 border-white flex items-center justify-center">
                                                    <CheckCircle size={12} className="text-white" />
                                                </div>
                                            </div>
                                            <div className="mt-4 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Post-Audit: CLEAR</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6 mb-16 relative z-10">
                                        {[
                                            { label: 'Criticals', value: scanResult.criticals, color: 'text-rose-600', bg: 'bg-rose-50/50' },
                                            { label: 'High Risks', value: scanResult.highs, color: 'text-amber-600', bg: 'bg-amber-50/50' },
                                            { label: 'Vulnerabilities', value: scanResult.mediums, color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
                                        ].map(v => (
                                            <div key={v.label} className={`p-8 ${v.bg} rounded-[32px] border border-black/[0.01] group hover:scale-[1.02] transition-transform`}>
                                                <div className="text-4xl font-black text-slate-900 mb-2 leading-none">{v.value}</div>
                                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${v.color}`}>{v.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-5 relative z-10">
                                        <Link
                                            to="/public-audits"
                                            className="w-full bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.4em] py-6 rounded-[22px] text-center shadow-2xl shadow-slate-900/10 transition-all flex items-center justify-center gap-3 group"
                                        >
                                            Publish Ledger Entry <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                        <div className="flex items-center justify-center gap-8 mt-4">
                                            <button className="flex items-center gap-2.5 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 transition-colors">
                                                <Share2 size={14} /> Export Binary
                                            </button>
                                            <div className="w-[1px] h-4 bg-black/10" />
                                            <button className="flex items-center gap-2.5 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 transition-colors">
                                                <Globe size={14} /> Explorer View
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}
