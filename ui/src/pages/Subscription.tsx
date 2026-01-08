import { Shield, Terminal, Zap, Activity, CreditCard } from 'lucide-react'

export default function Subscription() {
    return (
        <div className="space-y-10 animate-reveal">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Activity size={10} className="fill-indigo-600" />
                            Usage Monitor
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Neural <span className="text-indigo-600">Quota</span></h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Monitor your neural processing power and protocol auditing capacity in real-time.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn-primary h-12 px-8">
                        <Zap size={16} />
                        Buy Neural XP
                    </button>
                    <button className="btn-ghost h-12 px-8 border border-black/[0.03] bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all">
                        Upgrade Tier
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* XP Points Card */}
                <div className="card-premium relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Zap size={200} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-inner">
                                <Zap size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">Monthly Reset</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2 uppercase">Neural XP Points</h3>
                        <div className="flex items-baseline gap-2 mb-6">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">1,000</span>
                            <span className="text-slate-300 font-black text-sm uppercase">/ 1,000 XP</span>
                        </div>
                        <div className="space-y-3">
                            <div className="h-2 bg-slate-50 border border-black/[0.03] rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full w-full shadow-[0_0_12px_rgba(99,102,241,0.4)]" />
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Refreshes in 24 Days</span>
                                <span className="text-indigo-600">100% Capacity</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SLOC Capacity Card */}
                <div className="card-premium relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Terminal size={200} strokeWidth={1} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center border border-black/[0.03] shadow-inner">
                                <Terminal size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-black/[0.03] px-3 py-1 rounded-full">Per Protocol</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2 uppercase">SLOC Capacity</h3>
                        <div className="flex items-baseline gap-2 mb-6">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">200</span>
                            <span className="text-slate-300 font-black text-sm uppercase">SLOC / Unit</span>
                        </div>
                        <div className="space-y-3">
                            <div className="h-2 bg-slate-50 border border-black/[0.03] rounded-full overflow-hidden">
                                <div className="h-full bg-slate-900 rounded-full w-[10%] shadow-[0_0_12px_rgba(15,23,42,0.2)]" />
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Standard Sandbox Limit</span>
                                <span className="text-slate-900">0 SLOC Used</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Plan Card */}
            <div className="card-premium flex flex-col md:flex-row items-center justify-between gap-10 bg-slate-50/50">
                <div className="flex items-center gap-8">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.03] flex items-center justify-center text-indigo-600 shadow-xl">
                        <Shield size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Subscription Status</span>
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-500 text-[8px] font-black rounded-full uppercase tracking-widest">Active</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Audit Sandbox <span className="text-indigo-600">// Free Tier</span></h3>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Next Billing Cycle</div>
                        <div className="text-[11px] text-slate-900 font-black uppercase leading-none">Feb 20, 2026</div>
                    </div>
                    <button className="h-10 px-6 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">View Invoices</button>
                </div>
            </div>

            <div className="bg-slate-900 border border-black shadow-2xl p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-10 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] -rotate-12 transition-transform duration-1000">
                    <CreditCard size={180} strokeWidth={1} />
                </div>
                <div className="flex items-center gap-8 relative z-10">
                    <div className="w-14 h-14 rounded-[18px] bg-white/10 border border-white/10 flex items-center justify-center text-white/40 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-2xl transition-all duration-500">
                        <CreditCard size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Billing Registry</span>
                            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-full uppercase tracking-widest">Verified Source</span>
                        </div>
                        <div className="text-xl font-black tracking-tight leading-none uppercase">VISA Auth // 4242</div>
                    </div>
                </div>
                <button className="h-10 px-6 bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/10 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all relative z-10">Relink Source</button>
            </div>
        </div>
    )
}


