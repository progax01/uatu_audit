import { useState, useEffect } from 'react'
import { User, Shield, Bell, Wallet, Github, ExternalLink, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { getStoredUser, type AuthUser } from '../services/authService'

export default function Settings() {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const storedUser = getStoredUser()
        setUser(storedUser)
    }, [])

    const copyUserId = () => {
        if (user?.id) {
            navigator.clipboard.writeText(user.id)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className="space-y-8 animate-reveal max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                    Account <span className="text-indigo-600">Settings</span>
                </h1>
                <p className="text-slate-400 font-medium text-[13px] mt-2 leading-relaxed">
                    View your account information and connected services.
                </p>
            </div>

            {/* Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                        <User size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Profile</h2>
                        <p className="text-[11px] text-slate-400">Your account information</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Display Name */}
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Display Name</h3>
                            <p className="font-bold text-slate-900">{user?.displayName || user?.username || user?.githubLogin || 'Anonymous'}</p>
                        </div>
                    </div>

                    {/* Email */}
                    {user?.email && (
                        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</h3>
                                <p className="font-bold text-slate-900">{user.email}</p>
                            </div>
                        </div>
                    )}

                    {/* User ID */}
                    {user?.id && (
                        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User ID</h3>
                                <p className="font-mono text-sm text-slate-600 truncate">{user.id}</p>
                            </div>
                            <button
                                onClick={copyUserId}
                                className="ml-4 p-2 rounded-lg hover:bg-white transition-colors"
                            >
                                {copied ? (
                                    <Check size={16} className="text-emerald-500" />
                                ) : (
                                    <Copy size={16} className="text-slate-400" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Connected Services */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                        <Shield size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Connected Services</h2>
                        <p className="text-[11px] text-slate-400">Authentication methods linked to your account</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* GitHub */}
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                <Github size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">GitHub</h3>
                                {user?.githubLogin ? (
                                    <p className="text-[11px] text-emerald-600 font-medium">Connected as @{user.githubLogin}</p>
                                ) : (
                                    <p className="text-[11px] text-slate-400">Not connected</p>
                                )}
                            </div>
                        </div>
                        {user?.githubLogin && (
                            <a
                                href={`https://github.com/${user.githubLogin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg hover:bg-white transition-colors"
                            >
                                <ExternalLink size={16} className="text-slate-400" />
                            </a>
                        )}
                    </div>

                    {/* Wallet */}
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                <Wallet size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Wallet</h3>
                                {user?.walletAddress ? (
                                    <p className="text-[11px] text-emerald-600 font-mono">
                                        {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400">Not connected</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Coming Soon: Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card-premium opacity-60"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-400 flex items-center justify-center border border-rose-100">
                            <Bell size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Notifications</h2>
                            <p className="text-[11px] text-slate-400">Configure email and Telegram alerts</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-wider rounded-full">
                        Coming Soon
                    </span>
                </div>
            </motion.div>
        </div>
    )
}
