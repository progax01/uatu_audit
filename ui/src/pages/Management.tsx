import { Building2, Plus, Users, Zap, Mail, MoreHorizontal, ShieldCheck } from 'lucide-react'

export default function Management() {
    const team = [
        { name: 'Soneshwar S.', email: 'soneshwar@uataudit.sh', role: 'System Owner', status: 'ONLINE', initials: 'SS' },
        { name: 'Alex M.', email: 'alex.m@uataudit.sh', role: 'Security Architect', status: 'OFFLINE', initials: 'AM' },
        { name: 'Sarah L.', email: 'sarah.l@uataudit.sh', role: 'Audit Lead', status: 'ONLINE', initials: 'SL' },
    ]

    return (
        <div className="space-y-10 animate-reveal">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                            <Building2 size={10} className="fill-indigo-600" />
                            Control Plane
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Organization <span className="text-indigo-600">Management</span></h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Control center for team permissions, protocol owners, and sovereign administrative roles.
                    </p>
                </div>
                {team.length > 0 && (
                    <button className="btn-primary h-12 px-8">
                        <Plus size={16} />
                        Provision Member
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Personnel', value: `0${team.length}`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Security Leads', value: '03', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Verified Keys', value: '42', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Data Nodes', value: '09', icon: Building2, color: 'text-rose-600', bg: 'bg-rose-50' }
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

            {team.length === 0 ? (
                <div className="card-premium relative overflow-hidden flex flex-col items-center justify-center text-center py-24">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] -rotate-12">
                        <Users size={300} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 max-w-sm w-full flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8 border border-black/[0.03] shadow-inner">
                            <Users size={32} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">Registry Standby</h2>
                        <p className="text-slate-400 font-medium leading-relaxed mb-10 text-[14px]">
                            No personnel records currently localized. Provision your first security lead to proceed with mission control.
                        </p>
                        <button className="btn-primary w-full h-12 shadow-2xl shadow-indigo-100">
                            <Plus size={16} />
                            Provision First Member
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card-premium overflow-hidden !p-0">
                    <div className="px-8 py-5 border-b border-black/[0.03] flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-4">
                            <Users size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Personnel Registry</span>
                        </div>
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-black/[0.03] rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none">3 Systems Active</span>
                        </div>
                    </div>
                    <div className="divide-y divide-black/[0.03]">
                        {team.map((member) => (
                            <div key={member.email} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                                <div className="flex items-center gap-8">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-[18px] bg-slate-900 flex items-center justify-center text-[12px] font-black text-white shadow-xl group-hover:bg-indigo-600 transition-all duration-500">
                                            {member.initials}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] border-white ${member.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-black text-slate-900 text-base tracking-tight">{member.name}</h3>
                                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest group-hover:bg-white transition-all">ID-{member.initials}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <Mail size={12} className="text-slate-300" />
                                            {member.email}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Primary Assignment</div>
                                        <span className="px-2.5 py-0.5 bg-slate-50 border border-black/[0.03] rounded-full text-[9px] font-black text-slate-900 tracking-widest uppercase">{member.role}</span>
                                    </div>
                                    <button className="w-10 h-10 bg-slate-50 border border-black/[0.03] rounded-xl text-slate-300 hover:bg-slate-900 hover:text-white hover:shadow-2xl transition-all duration-500 flex items-center justify-center">
                                        <MoreHorizontal size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}


