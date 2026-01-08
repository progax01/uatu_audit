import { Shield, Copy, RefreshCw, Plus, Fingerprint, Eye, EyeOff, Lock, Zap, Key } from 'lucide-react'
import { useState } from 'react'

export default function Credentials() {
    const [showKey, setShowKey] = useState(false)

    const apiKeys = [
        { name: 'Production API Core', key: 'ua_live_7823...3h82', created: '2025-11-20', lastUsed: '3m ago', region: 'US-EAST-1' },
        { name: 'Development Sandbox', key: 'ua_test_92k3...kd92', created: '2025-11-18', lastUsed: '6h ago', region: 'Global' },
    ]

    return (
        <div className="space-y-10 animate-reveal">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Shield size={10} className="fill-indigo-600" />
                            Security Vault
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">API <span className="text-indigo-600">Credentials</span></h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Manage your secure access vectors and neural gatekeeper keys for decentralized auditing.
                    </p>
                </div>
                {apiKeys.length > 0 && (
                    <button className="btn-primary h-12 px-8">
                        <Plus size={16} />
                        New Access Key
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Keys', value: `0${apiKeys.length}`, icon: Lock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Key Rotations', value: '12', icon: RefreshCw, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Vault Status', value: 'Locked', icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'MFA Policy', value: 'Strict', icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat) => (
                    <div key={stat.label} className="card-premium !p-6 flex items-center gap-5">
                        <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                            <stat.icon size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1.5">{stat.label}</div>
                            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {apiKeys.length === 0 ? (
                <div className="card-premium relative overflow-hidden flex flex-col items-center justify-center text-center py-24">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Key size={300} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 max-w-sm w-full flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8 border border-black/[0.03] shadow-inner">
                            <Key size={32} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">Registry Standby</h2>
                        <p className="text-slate-400 font-medium leading-relaxed mb-10 text-[14px]">
                            No security credentials currently localized. Initialize your first access key to proceed with neural auditing.
                        </p>
                        <button className="btn-primary w-full h-12 shadow-2xl shadow-indigo-100">
                            <Plus size={16} />
                            Generate Initial Key
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card-premium overflow-hidden !p-0">
                    <div className="px-8 py-5 border-b border-black/[0.03] flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-4">
                            <Key size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Active Security Registry</span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-black/[0.03] rounded-full">
                            <Shield size={10} className="text-emerald-500 fill-emerald-500" />
                            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-none">AES-256 Encrypted</span>
                        </div>
                    </div>
                    <div className="divide-y divide-black/[0.03]">
                        {apiKeys.map((k) => (
                            <div key={k.key} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                                <div className="flex items-center gap-8">
                                    <div className="w-12 h-12 rounded-[16px] bg-slate-900 flex items-center justify-center text-white shadow-xl group-hover:bg-indigo-600 transition-all duration-500">
                                        <Fingerprint size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-black text-slate-900 text-base tracking-tight">{k.name}</h3>
                                            <span className="text-[8px] font-black border border-black/[0.03] px-2 py-0.5 rounded-full uppercase tracking-widest bg-white text-slate-400 group-hover:text-indigo-600 transition-colors">{k.region}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-3 bg-white border border-black/[0.03] pl-3 pr-2 py-2 rounded-xl transition-all shadow-sm">
                                                <code className="text-[10px] font-black text-indigo-600 font-mono tracking-widest">
                                                    {showKey ? k.key : '••••••••••••••••••••••••'}
                                                </code>
                                                <div className="w-px h-3.5 bg-slate-100" />
                                                <button onClick={() => setShowKey(!showKey)} className="text-slate-300 hover:text-indigo-600 transition-colors p-1">
                                                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                                                </button>
                                            </div>
                                            <button className="w-8 h-8 bg-white border border-black/[0.03] rounded-lg text-slate-300 hover:text-indigo-600 hover:shadow-lg transition-all flex items-center justify-center">
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Last Sync</div>
                                        <div className="text-[11px] text-slate-900 font-black uppercase leading-none">{k.lastUsed}</div>
                                    </div>
                                    <button className="w-10 h-10 bg-slate-50 border border-black/[0.03] rounded-xl text-slate-300 hover:bg-slate-900 hover:text-white hover:shadow-2xl transition-all duration-500 flex items-center justify-center">
                                        <RefreshCw size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="card-premium flex flex-col justify-between group">
                    <div>
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-10 border border-indigo-100/50 shadow-inner">
                            <Shield size={24} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">MFA Policy</h3>
                        <p className="text-[14px] text-slate-400 font-medium leading-relaxed mb-10 max-w-sm">Require multi-sig approval or hardware-level authentication for critical protocol architecture changes.</p>
                    </div>
                    <button className="btn-primary w-fit h-14 px-8">Configure Protection</button>
                </div>

                <div className="bg-slate-900 border border-black/[0.03] p-10 rounded-[40px] text-white flex flex-col justify-between relative overflow-hidden group shadow-2xl">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] -rotate-12 transition-transform duration-1000 group-hover:rotate-0">
                        <Zap size={140} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-10 border border-white/10 shadow-inner">
                            <RefreshCw size={24} className="text-white" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-4">Key Rotation</h3>
                        <p className="text-[14px] text-slate-300 font-medium leading-relaxed mb-10 max-w-sm">Automate the retirement of production credentials every 90 days to eliminate static vector risks.</p>
                    </div>
                    <button className="h-14 px-8 bg-white text-slate-900 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all relative z-10 shadow-3xl">Enable Automation</button>
                </div>
            </div>
        </div>
    )
}


