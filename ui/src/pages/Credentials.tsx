import { useState, useEffect } from 'react'
import {
    Shield, Wallet, Smartphone, LogOut, Clock,
    Monitor, Globe, Key, RefreshCw, Copy, Check,
    ExternalLink, Fingerprint, CreditCard, Play
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAccount, useDisconnect, useChainId } from 'wagmi'

// Explorer URLs for different chains (all use Etherscan-compatible API)
const CHAIN_EXPLORERS: Record<number, string> = {
    1: 'https://etherscan.io',
    42161: 'https://arbiscan.io',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    10: 'https://optimistic.etherscan.io',
    56: 'https://bscscan.com',
    43114: 'https://snowtrace.io',
}

interface ActivityLog {
    id: string
    type: 'login' | 'logout' | 'wallet_change' | 'recharge' | 'audit_started' | 'settings_change' | '2fa_change'
    description: string
    details?: string
    ip?: string
    device?: string
    location?: string
    timestamp: Date
    status: 'success' | 'warning' | 'failed'
}

const ACTIVITY_ICONS: Record<string, typeof Shield> = {
    login: Monitor,
    logout: LogOut,
    wallet_change: Wallet,
    recharge: CreditCard,
    audit_started: Play,
    settings_change: Key,
    '2fa_change': Shield,
}

export default function Credentials() {
    const { address, isConnected } = useAccount()
    const { disconnect } = useDisconnect()
    const chainId = useChainId()
    const explorerUrl = CHAIN_EXPLORERS[chainId] || 'https://etherscan.io'
    const [copied, setCopied] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const [passkeyEnabled, setPasskeyEnabled] = useState(false)
    const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false)
    const [showSetup2FA, setShowSetup2FA] = useState(false)
    const [activities, setActivities] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadSecurityData()
    }, [])

    const loadSecurityData = async () => {
        try {
            // Load activity logs (will connect to real API)
            const mockActivities: ActivityLog[] = [
                {
                    id: '1',
                    type: 'login',
                    description: 'Signed in via GitHub',
                    device: 'Chrome on macOS',
                    location: 'San Francisco, US',
                    ip: '192.168.1.xxx',
                    timestamp: new Date(Date.now() - 1000 * 60 * 5),
                    status: 'success'
                },
                {
                    id: '2',
                    type: 'recharge',
                    description: 'Purchased Pro tier',
                    details: '+6,000 Neurons, +5,000 SLOC',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
                    status: 'success'
                },
                {
                    id: '3',
                    type: 'audit_started',
                    description: 'Started audit on uniswap-v3',
                    details: 'Branch: main',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
                    status: 'success'
                },
                {
                    id: '4',
                    type: 'wallet_change',
                    description: 'Wallet address updated',
                    details: '0x71C7...d591',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
                    status: 'success'
                },
                {
                    id: '5',
                    type: 'login',
                    description: 'Signed in via GitHub',
                    device: 'Safari on iPhone',
                    location: 'New York, US',
                    ip: '10.0.0.xxx',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
                    status: 'success'
                },
            ]

            setActivities(mockActivities)
        } catch (err) {
            console.error('Failed to load security data:', err)
        } finally {
            setLoading(false)
        }
    }

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleLogoutEverywhere = async () => {
        setLoggingOut(true)
        try {
            await new Promise(resolve => setTimeout(resolve, 1500))
            window.location.href = '/auth/logout'
        } catch (err) {
            console.error('Failed to logout:', err)
        } finally {
            setLoggingOut(false)
        }
    }

    const formatTimeAgo = (date: Date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
        if (seconds < 60) return 'Just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return `${Math.floor(seconds / 86400)}d ago`
    }

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    if (loading) {
        return (
            <div className="space-y-8 animate-reveal">
                <div className="h-16 bg-slate-100/50 animate-pulse rounded-2xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="h-48 bg-slate-100/50 animate-pulse rounded-[32px]" />
                    <div className="h-48 bg-slate-100/50 animate-pulse rounded-[32px]" />
                    <div className="h-48 bg-slate-100/50 animate-pulse rounded-[32px]" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-reveal">
            {/* Security Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connected Wallet */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                            <Wallet size={18} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Wallet</h2>
                        </div>
                        {isConnected && (
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-black rounded-full uppercase">
                                Connected
                            </span>
                        )}
                    </div>

                    {isConnected && address ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-black/[0.03]">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg" />
                                <span className="font-mono text-sm text-slate-900 font-medium flex-1">{truncateAddress(address)}</span>
                                <button onClick={copyAddress} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all">
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                <a href={`${explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all">
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                            <button onClick={() => disconnect()} className="w-full h-10 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-indigo-600 transition-all">
                                Change Wallet
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-slate-400 text-xs mb-3">No wallet connected</p>
                            <button className="btn-primary h-10 px-5 text-xs">Connect Wallet</button>
                        </div>
                    )}
                </motion.div>

                {/* Passkey */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                            <Fingerprint size={18} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Passkey</h2>
                        </div>
                        <span className={`px-2 py-0.5 ${passkeyEnabled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'} border text-[8px] font-black rounded-full uppercase`}>
                            {passkeyEnabled ? 'Active' : 'Not Set'}
                        </span>
                    </div>

                    <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                        Use Face ID, Touch ID, or security key for passwordless sign-in.
                    </p>

                    <button
                        onClick={() => setPasskeyEnabled(!passkeyEnabled)}
                        className={`w-full h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all ${passkeyEnabled ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                    >
                        {passkeyEnabled ? 'Remove Passkey' : 'Setup Passkey'}
                    </button>
                </motion.div>

                {/* Authenticator App */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                            <Smartphone size={18} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Authenticator</h2>
                        </div>
                        <span className={`px-2 py-0.5 ${authenticatorEnabled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'} border text-[8px] font-black rounded-full uppercase`}>
                            {authenticatorEnabled ? 'Active' : 'Not Set'}
                        </span>
                    </div>

                    <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                        Use Google Authenticator, Authy, or 1Password for 2FA codes.
                    </p>

                    <button
                        onClick={() => authenticatorEnabled ? setAuthenticatorEnabled(false) : setShowSetup2FA(true)}
                        className={`w-full h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all ${authenticatorEnabled ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                    >
                        {authenticatorEnabled ? 'Disable 2FA' : 'Setup Authenticator'}
                    </button>
                </motion.div>
            </div>

            {/* Danger Zone */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card-premium border-rose-100 bg-rose-50/30"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                            <LogOut size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Sign Out Everywhere</h2>
                            <p className="text-[11px] text-slate-500">End all active sessions on all devices</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogoutEverywhere}
                        disabled={loggingOut}
                        className="h-10 px-5 bg-rose-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loggingOut ? <RefreshCw size={14} className="animate-spin" /> : null}
                        {loggingOut ? 'Signing out...' : 'Sign Out All'}
                    </button>
                </div>
            </motion.div>

            {/* Activity History */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card-premium !p-0 overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-black/[0.03] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock size={16} className="text-slate-400" />
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Activity History</h2>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Recent</span>
                </div>

                <div className="divide-y divide-black/[0.03]">
                    {activities.length === 0 ? (
                        <div className="p-12 text-center">
                            <Clock size={32} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-slate-400 text-sm">No activity yet</p>
                        </div>
                    ) : (
                        activities.map((activity, index) => {
                            const Icon = ACTIVITY_ICONS[activity.type] || Shield
                            return (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + index * 0.05 }}
                                    className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-all"
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                        activity.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                        activity.status === 'warning' ? 'bg-amber-50 text-amber-600' :
                                        'bg-rose-50 text-rose-600'
                                    }`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm">{activity.description}</div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                                            {activity.details && <span>{activity.details}</span>}
                                            {activity.device && (
                                                <>
                                                    {activity.details && <span className="w-1 h-1 rounded-full bg-slate-300" />}
                                                    <span>{activity.device}</span>
                                                </>
                                            )}
                                            {activity.location && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <Globe size={10} />
                                                    <span>{activity.location}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                                        {formatTimeAgo(activity.timestamp)}
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </motion.div>

            {/* 2FA Setup Modal */}
            {showSetup2FA && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-md" onClick={() => setShowSetup2FA(false)} />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 border border-black/[0.03]"
                    >
                        <h2 className="text-xl font-black text-slate-900 mb-2">Setup Authenticator</h2>
                        <p className="text-slate-400 text-sm mb-6">Scan with your authenticator app</p>

                        <div className="w-40 h-40 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-6 border border-black/[0.03]">
                            <div className="text-slate-300 text-center">
                                <Shield size={32} className="mx-auto mb-2" />
                                <span className="text-[10px]">QR Code</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                className="w-full h-12 px-4 bg-slate-50 border border-black/[0.03] rounded-xl text-center text-lg font-mono font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all tracking-[0.5em]"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowSetup2FA(false)} className="flex-1 h-11 bg-slate-50 border border-black/[0.03] rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all">
                                Cancel
                            </button>
                            <button onClick={() => { setAuthenticatorEnabled(true); setShowSetup2FA(false) }} className="flex-1 btn-primary h-11">
                                Enable
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
