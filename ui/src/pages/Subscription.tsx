import { useState, useEffect } from 'react'
import { Shield, Code2, Zap, Activity, FileText, History, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { authFetch } from '../services/authService'
import BuyNeuronsModal from '../components/BuyNeuronsModal'

interface BillingBalance {
    neurons: {
        balance: number
        lifetime: number
    }
    sloc: {
        balance: number
        used: number
        available: number
    }
    aiCalls: {
        balance: number
        used: number
        available: number
    }
    tier: 'free' | 'pro' | 'enterprise'
    monthlyReset: {
        at: string | null
        daysRemaining: number
    }
}

interface PurchaseHistory {
    id: string
    tier: string
    amountUsd: number
    neuronsAwarded: number
    slocAwarded: number
    aiCallsAwarded: number
    status: string
    createdAt: string
}

const TIER_LABELS: Record<string, { name: string; color: string }> = {
    free: { name: 'Free Tier', color: 'text-slate-600' },
    pro: { name: 'Pro Tier', color: 'text-indigo-600' },
    enterprise: { name: 'Enterprise', color: 'text-purple-600' },
}

export default function Subscription() {
    const [balance, setBalance] = useState<BillingBalance | null>(null)
    const [history, setHistory] = useState<PurchaseHistory[]>([])
    const [loading, setLoading] = useState(true)
    const [showBuyModal, setShowBuyModal] = useState(false)

    useEffect(() => {
        fetchBillingData()
    }, [])

    const fetchBillingData = async () => {
        try {
            const [balanceRes, historyRes] = await Promise.all([
                authFetch('/api/billing/balance'),
                authFetch('/api/billing/history'),
            ])

            if (balanceRes.ok) {
                const data = await balanceRes.json()
                setBalance(data)
            }

            if (historyRes.ok) {
                const data = await historyRes.json()
                setHistory(data.purchases || [])
            }
        } catch (err) {
            console.error('Failed to fetch billing data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handlePurchaseComplete = () => {
        setShowBuyModal(false)
        fetchBillingData() // Refresh data after purchase
    }

    if (loading) {
        return (
            <div className="space-y-10 animate-reveal">
                <div className="h-20 bg-slate-100/50 animate-pulse rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="h-64 bg-slate-100/50 animate-pulse rounded-[32px]" />
                    <div className="h-64 bg-slate-100/50 animate-pulse rounded-[32px]" />
                </div>
                <div className="h-32 bg-slate-100/50 animate-pulse rounded-[32px]" />
            </div>
        )
    }

    const neuronsPercent = balance ? Math.min(100, (balance.neurons.balance / Math.max(balance.neurons.lifetime || 100, 100)) * 100) : 0
    const slocPercent = balance ? Math.min(100, (balance.sloc.used / Math.max(balance.sloc.balance, 1)) * 100) : 0
    const aiPercent = balance ? Math.min(100, (balance.aiCalls.used / Math.max(balance.aiCalls.balance, 1)) * 100) : 0
    const tierInfo = TIER_LABELS[balance?.tier || 'free']

    return (
        <div className="space-y-10 animate-reveal">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Activity size={10} />
                            Usage Monitor
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                        Neural <span className="text-indigo-600">Quota</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Monitor your neural processing power and protocol auditing capacity in real-time.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowBuyModal(true)}
                        className="btn-primary h-12 px-8"
                    >
                        <Sparkles size={16} />
                        Buy Neurons
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Neurons Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Zap size={180} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100">
                                <Zap size={22} strokeWidth={2.5} />
                            </div>
                            {balance?.tier === 'free' && (
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                                    {balance.monthlyReset.daysRemaining}d Reset
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-black text-slate-400 tracking-tight mb-1 uppercase">Neurons</h3>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                                {balance?.neurons.balance.toLocaleString() || 0}
                            </span>
                            <span className="text-slate-300 font-black text-sm uppercase">available</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.max(5, neuronsPercent)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Lifetime: {balance?.neurons.lifetime.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* SLOC Capacity Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card-premium relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Code2 size={180} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center border border-black/[0.03]">
                                <Code2 size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white border border-black/[0.03] px-2.5 py-1 rounded-full">
                                Global Pool
                            </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-400 tracking-tight mb-1 uppercase">SLOC Capacity</h3>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                                {balance?.sloc.available.toLocaleString() || 0}
                            </span>
                            <span className="text-slate-300 font-black text-sm uppercase">/ {balance?.sloc.balance.toLocaleString() || 0}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-slate-900 rounded-full transition-all duration-500"
                                    style={{ width: `${slocPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>{balance?.sloc.used.toLocaleString() || 0} SLOC Used</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* AI Reports Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card-premium relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <FileText size={180} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                                <FileText size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                                AI Reports
                            </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-400 tracking-tight mb-1 uppercase">AI Agent Calls</h3>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">
                                {balance?.aiCalls.available || 0}
                            </span>
                            <span className="text-slate-300 font-black text-sm uppercase">/ {balance?.aiCalls.balance || 0}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                                    style={{ width: `${aiPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>{balance?.aiCalls.used || 0} Reports Generated</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Current Plan Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card-premium flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-br from-slate-50 to-white"
            >
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.03] flex items-center justify-center text-indigo-600 shadow-lg">
                        <Shield size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Current Plan</span>
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-black rounded-full uppercase tracking-widest">
                                Active
                            </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                            Audit Sandbox <span className={tierInfo.color}>// {tierInfo.name}</span>
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Pay-as-you-go</div>
                        <div className="text-[11px] text-slate-600 font-bold">Neurons never expire</div>
                    </div>
                    <button
                        onClick={() => setShowBuyModal(true)}
                        className="h-10 px-6 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg"
                    >
                        Purchase History
                    </button>
                </div>
            </motion.div>

            {/* Purchase History */}
            {history.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <History size={18} className="text-slate-400" />
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Purchases</h3>
                    </div>
                    <div className="space-y-3">
                        {history.slice(0, 5).map((purchase) => (
                            <div
                                key={purchase.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-black/[0.02]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 text-sm uppercase">{purchase.tier} Tier</div>
                                        <div className="text-[10px] text-slate-400 font-bold">
                                            +{purchase.neuronsAwarded.toLocaleString()} neurons, +{purchase.slocAwarded.toLocaleString()} SLOC
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-slate-900 text-sm">${purchase.amountUsd}</div>
                                    <div className="text-[10px] text-slate-400 font-bold">
                                        {new Date(purchase.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Buy Neurons Modal */}
            <BuyNeuronsModal
                isOpen={showBuyModal}
                onClose={() => setShowBuyModal(false)}
                onPurchaseComplete={handlePurchaseComplete}
            />
        </div>
    )
}
